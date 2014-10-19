var util = require('mace');

var path = require('path');
var fs = require('fs');
var debug = util.debug('clam:config');
var mkdirpSync = util.mkdirPSync;
var _watchCache = {};
function Config (name) {
  if (!(this instanceof Config)) {
    return new Config(name);
  }
  if (!name.match(/^[a-z]$/i)) {
    return throw Error('Unexpected special string in name: %s', name);
  }
  this.name = '.' + name;
  this._configs = {};
}

util.inherits(Config, {
  init: function (rootdir, configs) {
    var self = this;
    var rootdir = rootdir || process.cwd();
    debug.warn('watching at %s', rootdir);
    mkdirpSync(rootdir + path.sep + self.name + path.sep);
    util.each(configs, function (config, name) {
      var file = path.join(rootdir, name);
      if(!fs.existsSync(file)) {
        fs.writeFileSync(file, '#!/usr/bin/env node\nexports = module.exports = ' + JSON.stringify(config, null, 2));
      }
    });
    util.done('config init succeed');
    return this;
  },
  watch: function (rootdir) {
    var self = this;
    var rootdir = path.join(rootdir || process.cwd(), this.name);
    
    if (!fs.existsSync(rootdir) || !fs.statSync(rootdir).isDirectory()) {
      util.error('Directory %s not exists. Please run init first!', rootdir);
      return process.exit(0);
    }
    if (!fs.existsSync(path.join(rootdir, this.name)) {
      util.error('Config %s not exists. Please run init first!', this.name);
      return process.exit(0);
    }
    if (!self.unwatch(rootdir)) {
      return false;
    }
    self._load(rootdir);
    return self._watch(rootdir);
  },
  unwatch: function (rootdir) {
    var self = this;
    var rootdir = path.join(rootdir || process.cwd(), self.name);
    if (!_watchCache[rootdir]) {
      return true;
    }
    try {
      util.trace('Try to close %s watcher', rootdir);
      _watchCache[rootdir].close();
      util.done('Close %s watcher succeed.', rootdir);
      return true;
    } catch(e) {
      util.error('Close %s watcher failed.', rootdir);
      return false;
    }
  },
  _watch: function (rootdir) {
    var self = this;
    try {
      return _watcher[rootdir] = fs.watch(rootdir, function (e, filename) {
        var filepath = path.join(rootdir, filename);
        if (filename[0] === '.' && filename !== self.name) {
          return;
        }
        debug.warn('file: %s change;', filepath);
        try {
          _config[filename] = util.use(filepath);
        } catch (e) {
          self.emit(filename + ':load:failed', e);
          debug.error('The file %s load failed', filepath);
        }
      });
    } catch(e) {
      debug.error(e);
      util.error('Failed to watch %s.', rootdir);
      return false;
    }
  },
  _load: function (rootdir) {
    var self = this;
    var configs = self._configs;
    util.each(fs.readdirSync(rootdir), function (filename) {
      if (filename[0] === '.' && filename !== self.name) {
        return;
      }
      var filepath = path.join(rootdir, filename);
      try {
        var value = util.use(filepath);
      } catch (e) {
        var value = _config[filename] || {};
        debug('The file %s load failed', filename);
        self.emit(filename + ':load:failed', e);
      }
      Object.defineProperty(_config, filename, {
        // 可枚举
        enumerable: true,
        // 不可删除
        configurable: false,
        get: function () {
          return value
        },
        set: function (v) {
          var merge = value;
          try {
            value = util.merge(true, value, v || {});
            self.emit(basename + ':set:done', value);
          } catch(e) {
            value = merge;
            e.newValue = v;
            e.oldValue = value;
            self.emit(basename + ':set:failed', e);
          }
        }
      });
    });
  },
  get: function (ns) {
    if (ns === 'CONFIG') {return this._configs;}
    return getFromNameSpace(this._configs, (ns||'').split(/[^a-z0-9\_\$]/));
  },
  set: function (ns, val) {
    return setFromNameSpace(this._configs, (ns || '').split(/[^a-z0-9\_\$]/), val, true);
  }
}, require('events').EventEmitter);

function setFromNameSpace (scope, ns, val) {
  if (!ns.length) {
    return false
  }
  // 最后一个字段名
  var key = ns.pop();
  while (ns.length) {
    var name = ns.shift();
    scope = scope[name] = scope[name] || {};
  }
  scope[key] = val;
  return true;
}

function getFromNameSpace (scope, ns) {
  while(ns.length) {
    var name = ns.shift();
    if (!scope[name]) {
      return null;
    }
    scope = scope[name];
  }
  return scope;
}
module.exports = Config;