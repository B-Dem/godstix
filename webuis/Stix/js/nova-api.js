var NovaAPI = (function() {
    var baseUrl = '';
    var cache = {};
    var refreshInterval = null;
    var listeners = {};
    var authToken = null;

    var _imgCache = (function() {
        var DB_NAME = 'NovaImgCache';
        var STORE = 'images';
        var db = null;
        function open(cb) {
            if (db) return cb(db);
            try {
                var req = indexedDB.open(DB_NAME, 1);
                req.onupgradeneeded = function(e) { e.target.result.createObjectStore(STORE); };
                req.onsuccess = function(e) { db = e.target.result; cb(db); };
                req.onerror = function() { cb(null); };
            } catch(e) { cb(null); }
        }
        return {
            get: function(key, cb) {
                open(function(d) {
                    if (!d) return cb(null);
                    try {
                        var tx = d.transaction(STORE, 'readonly');
                        var r = tx.objectStore(STORE).get(key);
                        r.onsuccess = function() { cb(r.result || null); };
                        r.onerror = function() { cb(null); };
                    } catch(e) { cb(null); }
                });
            },
            set: function(key, blob) {
                open(function(d) {
                    if (!d) return;
                    try { d.transaction(STORE, 'readwrite').objectStore(STORE).put(blob, key); } catch(e) {}
                });
            },
            remove: function(key) {
                open(function(d) {
                    if (!d) return;
                    try { d.transaction(STORE, 'readwrite').objectStore(STORE).delete(key); } catch(e) {}
                });
            }
        };
    })();

    var _imgQueue = [];
    var _imgActive = 0;
    var _imgMaxConcurrent = 5;

    function _processQueue() {
        while (_imgActive < _imgMaxConcurrent && _imgQueue.length > 0) {
            var job = _imgQueue.shift();
            _imgActive++;
            job(function() {
                _imgActive--;
                _processQueue();
            });
        }
    }

    function getUrl(endpoint) {
        return baseUrl + endpoint;
    }

    function loadToken() {
        try {
            var t = localStorage.getItem('token');
            if (t) authToken = t;
        } catch(e) {}
    }

    function saveToken(token) {
        authToken = token;
        try { localStorage.setItem('token', token); } catch(e) {}
    }

    function clearToken() {
        authToken = null;
        try { localStorage.removeItem('token'); } catch(e) {}
    }

    function ajax(method, url, callback, body, contentType, skipSecurityCheck) {
        var xhr = new XMLHttpRequest();
        xhr.open(method, url, true);
        if (contentType) {
            xhr.setRequestHeader('Content-Type', contentType);
        }
        if (authToken) {
            xhr.setRequestHeader('Authorization', 'Bearer ' + authToken);
        }
        xhr.timeout = 15000;
        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
                var secHeader = xhr.getResponseHeader('X-Security-Enabled');
                var loginRequired = secHeader === '1' || secHeader === 'true';

                if (xhr.status === 401) {
                    var err = new Error('HTTP 401');
                    err.status = 401;
                    err.loginRequired = true;
                    emit('session_expired');
                    return callback(err);
                }

                if (xhr.status >= 200 && xhr.status < 300) {
                    if (loginRequired && !authToken && !skipSecurityCheck) {
                        var err2 = new Error('Login required');
                        err2.status = 401;
                        err2.loginRequired = true;
                        return callback(err2);
                    }
                    var text = xhr.responseText || '';
                    if (!text || !text.trim()) {
                        callback(null, null, loginRequired);
                    } else {
                        try {
                            var json = JSON.parse(text);
                            callback(null, json, loginRequired);
                        } catch(e) {
                            callback(null, text, loginRequired);
                        }
                    }
                } else {
                    var error = new Error('HTTP ' + xhr.status);
                    error.status = xhr.status;
                    if (loginRequired && !authToken) error.loginRequired = true;
                    callback(error);
                }
            }
        };
        xhr.onerror = function() { callback(new Error('Network error')); };
        xhr.ontimeout = function() { callback(new Error('Timeout')); };
        xhr.send(body || null);
    }

    function get(endpoint, callback) {
        ajax('GET', getUrl(endpoint), callback);
    }

    function postJson(endpoint, data, callback) {
        ajax('POST', getUrl(endpoint), callback, JSON.stringify(data), 'application/json');
    }

    function emit(event, data) {
        if (listeners[event]) {
            for (var i = 0; i < listeners[event].length; i++) {
                listeners[event][i](data);
            }
        }
    }

    loadToken();

    return {
        on: function(event, cb) {
            if (!listeners[event]) listeners[event] = [];
            listeners[event].push(cb);
        },

        authenticate: function(username, password, callback) {
            var params = new URLSearchParams();
            params.append('username', username);
            params.append('password', password);
            ajax('POST', getUrl('/authenticate'), function(err, data) {
                if (!err && data && data.token) {
                    saveToken(data.token);
                }
                callback(err, data);
            }, params.toString(), 'application/x-www-form-urlencoded', true);
        },

        isAuthenticated: function() { return !!authToken; },

        logout: function() {
            clearToken();
            cache = {};
        },

        init: function(callback) {
            get('/system', function(err, data, securityEnabled) {
                if (err) return callback(err);
                cache.system = data;
                callback(null, data, securityEnabled);
            });
        },

        getSystemInfo: function(callback) {
            get('/system', function(err, data) {
                if (!err) cache.system = data;
                callback(err, data);
            });
        },

        getTemperature: function(callback) {
            get('/temperature', function(err, data) {
                if (!err) cache.temperature = data;
                callback(err, data);
            });
        },

        getSMCInfo: function(callback) {
            get('/smc', function(err, data) {
                if (!err) cache.smc = data;
                callback(err, data);
            });
        },

        getMemory: function(callback) {
            get('/memory', function(err, data) {
                if (!err) cache.memory = data;
                callback(err, data);
            });
        },

        getProfiles: function(callback) {
            get('/profile', function(err, data) {
                if (!err) cache.profiles = data;
                callback(err, data);
            });
        },

        getPluginInfo: function(callback) {
            get('/plugin', function(err, data) {
                if (!err) cache.plugin = data;
                callback(err, data);
            });
        },

        getTitleInfo: function(callback) {
            get('/title', function(err, data) {
                if (!err) cache.title = data;
                callback(err, data);
            });
        },

        getLiveInfo: function(callback) {
            var url = getUrl('/title/live/cache');
            var xhr = new XMLHttpRequest();
            xhr.open('GET', url, true);
            if (authToken) xhr.setRequestHeader('Authorization', 'Bearer ' + authToken);
            xhr.timeout = 15000;
            xhr.onload = function() {
                if (xhr.status >= 200 && xhr.status < 300) {
                    var text = xhr.responseText || '';
                    if (!text.trim()) return callback(null, null);

                    var extractTag = function(txt, tag) {
                        var re = new RegExp('<(?:[a-zA-Z]+:)?' + tag + '(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[a-zA-Z]+:)?' + tag + '\\s*>', 'i');
                        var m = txt.match(re);
                        if (m && m[1]) {
                            return m[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
                        }
                        return '';
                    };

                    var info = {
                        description: extractTag(text, 'description'),
                        reduceddescription: extractTag(text, 'reducedDescription') || extractTag(text, 'SummaryDescription'),
                        publisher: extractTag(text, 'publisher'),
                        developer: extractTag(text, 'developer'),
                        fulltitle: extractTag(text, 'fullTitle'),
                        reducedtitle: extractTag(text, 'reducedTitle') || extractTag(text, 'gameReducedTitle'),
                        releasedate: extractTag(text, 'releaseDate'),
                        ratingid: extractTag(text, 'ratingId')
                    };

                    var hasData = info.description || info.reduceddescription || info.publisher || info.developer;
                    callback(null, hasData ? info : null);
                } else if (xhr.status === 404) {
                    callback(null, null);
                } else {
                    callback(new Error('HTTP ' + xhr.status));
                }
            };
            xhr.onerror = function() { callback(new Error('Network error')); };
            xhr.ontimeout = function() { callback(new Error('Timeout')); };
            xhr.send();
        },

        getScreencaptureCount: function(callback) {
            get('/screencapture', callback);
        },

        getScreencaptureMeta: function(callback) {
            get('/screencapture/meta', callback);
        },

        getScreencaptureList: function(callback) {
            get('/screencapture/meta/list', callback);
        },

        getScreencaptureUrl: function(uuid) {
            return getUrl('/image/screencapture?uuid=' + uuid);
        },

        getProfileImageUrl: function(uuid) {
            return getUrl('/image/profile?uuid=' + uuid);
        },

        getAchievementImageUrl: function(titleId, imageId) {
            return getUrl('/image/achievement?uuid=' + encodeURIComponent(imageId) + '&t=' + encodeURIComponent(titleId));
        },

        takeScreencapture: function(callback) {
            get('/screencapture/meta', callback);
        },

        deleteScreencapture: function(uuid, callback) {
            ajax('DELETE', getUrl('/screencapture') + '?uuid=' + encodeURIComponent(uuid), callback);
        },

        loadAuthImage: function(url, imgElement, onDone, uniqueId) {
            if (!url) {
                imgElement.src = 'img/noboxart.svg';
                if (onDone) onDone();
                return;
            }

            var isExternal = url.indexOf('http://') === 0 || url.indexOf('https://') === 0;

            if (isExternal) {
                imgElement.src = url;
                imgElement.onerror = function() { this.src = 'img/noboxart.svg'; this.onerror = null; };
                if (onDone) imgElement.onload = function() { if (onDone) onDone(); };
                return;
            }

            if (!authToken) {
                imgElement.src = url;
                imgElement.onerror = function() { this.src = 'img/noboxart.svg'; this.onerror = null; };
                if (onDone) imgElement.onload = function() { if (onDone) onDone(); };
                return;
            }

            var baseCacheKey = url.replace(/.*\//, '');
            var cacheKey = uniqueId ? baseCacheKey + '#' + uniqueId : baseCacheKey;
            _imgCache.get(cacheKey, function(blob) {
                if (blob) {
                    imgElement.src = URL.createObjectURL(blob);
                    if (onDone) onDone();
                    return;
                }

                var xhr = new XMLHttpRequest();
                xhr.open('GET', url, true);
                xhr.responseType = 'blob';
                xhr.setRequestHeader('Authorization', 'Bearer ' + authToken);
                xhr.onload = function() {
                    if (xhr.status === 200 && xhr.response) {
                        imgElement.src = URL.createObjectURL(xhr.response);
                        _imgCache.set(cacheKey, xhr.response);
                    } else {
                        imgElement.src = 'img/noboxart.svg';
                    }
                    if (onDone) onDone();
                };
                xhr.onerror = function() {
                    imgElement.src = 'img/noboxart.svg';
                    if (onDone) onDone();
                };
                xhr.send();
            });
        },

        loadAuthBackgroundImage: function(url, divElement) {
            if (!url) return;
            var isExternal = url.indexOf('http://') === 0 || url.indexOf('https://') === 0;
            if (isExternal || !authToken) {
                divElement.style.backgroundImage = 'url(' + url + ')';
                return;
            }
            var cacheKey = url.replace(/.*\//, '');
            _imgCache.get(cacheKey, function(blob) {
                if (blob) {
                    divElement.style.backgroundImage = 'url(' + URL.createObjectURL(blob) + ')';
                    return;
                }
                var xhr = new XMLHttpRequest();
                xhr.open('GET', url, true);
                xhr.responseType = 'blob';
                xhr.setRequestHeader('Authorization', 'Bearer ' + authToken);
                xhr.onload = function() {
                    if (xhr.status === 200 && xhr.response) {
                        divElement.style.backgroundImage = 'url(' + URL.createObjectURL(xhr.response) + ')';
                        _imgCache.set(cacheKey, xhr.response);
                    }
                };
                xhr.onerror = function() {};
                xhr.send();
            });
        },

        downloadAuthFile: function(url, filename) {
            if (!authToken) {
                window.open(url, '_blank');
                return;
            }
            var xhr = new XMLHttpRequest();
            xhr.open('GET', url, true);
            xhr.responseType = 'blob';
            xhr.setRequestHeader('Authorization', 'Bearer ' + authToken);
            xhr.onload = function() {
                if (xhr.status === 200) {
                    var a = document.createElement('a');
                    a.href = URL.createObjectURL(xhr.response);
                    a.download = filename || 'download';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                }
            };
            xhr.send();
        },

        getDashLaunch: function(callback) {
            get('/dashlaunch', callback);
        },

        getSystemLink: function(callback) {
            get('/systemlink', callback);
        },

        getSystemLinkBandwidth: function(callback) {
            get('/systemlink/bandwidth', callback);
        },

        getThreads: function(callback) {
            get('/thread', callback);
        },

        getTitlesJson: function(callback) {
            ajax('GET', getUrl('/api/titles.json'), function(err, data) {
                if (!err) cache.titles = data;
                callback(err, data);
            });
        },

        getAchievements: function(titleId, callback) {
            get('/achievement?titleid=' + titleId, callback);
        },

        getPlayerAchievements: function(titleId, callback) {
            get('/achievement/player?titleid=' + titleId, callback);
        },

        getMultidisc: function(titleId, callback) {
            get('/multidisc?titleid=' + titleId, callback);
        },

        getUpdateNotification: function(callback) {
            get('/update/notification', callback);
        },

        launchTitle: function(game, callback) {
            var formData = new FormData();
            formData.append('path', game.directory || '');
            formData.append('exec', game.executable || '');
            formData.append('type', String(game.type != null ? game.type : game.contentGroup != null ? game.contentGroup : ''));
            ajax('POST', getUrl('/title/launch'), callback, formData);
        },

        startAutoRefresh: function(intervalMs) {
            var self = this;
            if (refreshInterval) clearInterval(refreshInterval);
            refreshInterval = setInterval(function() {
                self.getTemperature(function(err, data) {
                    if (!err) emit('temperature', data);
                });
                self.getMemory(function(err, data) {
                    if (!err) emit('memory', data);
                });
                self.getTitleInfo(function(err, data) {
                    if (!err) emit('title', data);
                });
                self.getUpdateNotification(function(err, data) {
                    if (!err) emit('notification', data);
                });
            }, intervalMs || 5000);
        },

        stopAutoRefresh: function() {
            if (refreshInterval) {
                clearInterval(refreshInterval);
                refreshInterval = null;
            }
        },

        loadAuthImageQueued: function(url, imgElement) {
            var self = this;
            _imgQueue.push(function(done) {
                self.loadAuthImage(url, imgElement, done);
            });
            _processQueue();
        },

        removeFromImageCache: function(uuid) {
            _imgCache.remove('screencapture?uuid=' + uuid);
        },

        getFileList: function(path, callback) {
            var listPath = path || '';
            if (listPath && listPath.charAt(listPath.length - 1) !== '\\') {
                listPath += '\\';
            }
            get('/filebrowser?path=' + encodeURIComponent(listPath), callback);
        },

        getFileUrl: function(path) {
            if (path && path.toLowerCase().indexOf('game:') === 0) {
                var relativePath = path.substring(5);
                if (relativePath.charAt(0) === '\\') relativePath = relativePath.substring(1);
                return getUrl('/title/file?path=' + encodeURIComponent(relativePath));
            }
            return getUrl('/filebrowser?path=' + encodeURIComponent(path));
        },

        downloadFileFromConsole: function(path, filename) {
            var url = this.getFileUrl(path);
            if (!authToken) {
                window.open(url, '_blank');
                return;
            }
            var xhr = new XMLHttpRequest();
            xhr.open('GET', url, true);
            xhr.responseType = 'blob';
            xhr.setRequestHeader('Authorization', 'Bearer ' + authToken);
            xhr.onload = function() {
                if (xhr.status === 200 && xhr.response) {
                    var a = document.createElement('a');
                    a.href = URL.createObjectURL(xhr.response);
                    a.download = filename || 'download';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                }
            };
            xhr.send();
        },

        getCache: function() { return cache; },

        setCmsUrl: function(url) {
            try {
                if (url) {
                    url = url.trim().replace(/\/+$/, '');
                    if (url && !/^https?:\/\//i.test(url)) {
                        url = 'http://' + url;
                    }
                    localStorage.setItem('nova_cms_url', url);
                } else {
                    localStorage.removeItem('nova_cms_url');
                }
            } catch(e) {}
        },

        getCmsUrl: function() {
            return 'http://stix.speedygamesdownloads.com';
        },

        getCmsAuthToken: function() {
            try { return localStorage.getItem('cms_auth_token') || null; } catch(e) { return null; }
        },

        setCmsAuthToken: function(token) {
            try {
                if (token) localStorage.setItem('cms_auth_token', token);
                else localStorage.removeItem('cms_auth_token');
            } catch(e) {}
        },

        getCmsProfileData: function() {
            try {
                var d = localStorage.getItem('cms_profile');
                return d ? JSON.parse(d) : null;
            } catch(e) { return null; }
        },

        setCmsProfileData: function(profile) {
            try {
                if (profile) localStorage.setItem('cms_profile', JSON.stringify(profile));
                else localStorage.removeItem('cms_profile');
            } catch(e) {}
        },

        cmsLogin: function(login, password, callback) {
            var self = this;
            var cmsUrl = this.getCmsUrl();
            var xhr = new XMLHttpRequest();
            xhr.open('POST', cmsUrl + '/api/profile/login', true);
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.timeout = 15000;
            xhr.onload = function() {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        var resp = JSON.parse(xhr.responseText);
                        if (resp.success && resp.token) {
                            self.setCmsAuthToken(resp.token);
                            self.setCmsProfileData(resp.profile);
                            callback(null, resp);
                        } else {
                            callback(new Error(resp.error || 'Login failed'));
                        }
                    } catch(e) {
                        callback(new Error('Invalid response'));
                    }
                } else {
                    try {
                        var errResp = JSON.parse(xhr.responseText);
                        callback(new Error(errResp.error || 'HTTP ' + xhr.status));
                    } catch(e) {
                        callback(new Error('HTTP ' + xhr.status));
                    }
                }
            };
            xhr.onerror = function() { callback(new Error('Network error')); };
            xhr.ontimeout = function() { callback(new Error('Timeout')); };
            xhr.send(JSON.stringify({ login: login, password: password }));
        },

        cmsLogout: function() {
            this.setCmsAuthToken(null);
            this.setCmsProfileData(null);
        },

        getCmsProfile: function(callback) {
            var token = this.getCmsAuthToken();
            var profile = this.getCmsProfileData();
            if (!token || !profile || !profile.id) return callback(new Error('Not logged in'));
            var cmsUrl = this.getCmsUrl();
            var xhr = new XMLHttpRequest();
            xhr.open('GET', cmsUrl + '/api/profile/' + profile.id, true);
            xhr.setRequestHeader('Authorization', 'Bearer ' + token);
            xhr.timeout = 15000;
            xhr.onload = function() {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        var resp = JSON.parse(xhr.responseText);
                        if (resp.success) callback(null, resp.profile);
                        else callback(new Error(resp.error || 'Failed'));
                    } catch(e) { callback(new Error('Invalid response')); }
                } else { callback(new Error('HTTP ' + xhr.status)); }
            };
            xhr.onerror = function() { callback(new Error('Network error')); };
            xhr.ontimeout = function() { callback(new Error('Timeout')); };
            xhr.send();
        },

        getCmsStats: function(profileId, callback) {
            var token = this.getCmsAuthToken();
            var cmsUrl = this.getCmsUrl();
            var xhr = new XMLHttpRequest();
            xhr.open('GET', cmsUrl + '/api/profile/' + profileId + '/stats', true);
            if (token) xhr.setRequestHeader('Authorization', 'Bearer ' + token);
            xhr.timeout = 15000;
            xhr.onload = function() {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        var resp = JSON.parse(xhr.responseText);
                        if (resp.success) callback(null, resp);
                        else callback(new Error(resp.error || 'Failed'));
                    } catch(e) { callback(new Error('Invalid response')); }
                } else { callback(new Error('HTTP ' + xhr.status)); }
            };
            xhr.onerror = function() { callback(new Error('Network error')); };
            xhr.ontimeout = function() { callback(new Error('Timeout')); };
            xhr.send();
        },

        getNotifications: function(profileId, callback) {
            var token = this.getCmsAuthToken();
            if (!token) return callback(new Error('Not logged in'));
            var cmsUrl = this.getCmsUrl();
            var xhr = new XMLHttpRequest();
            xhr.open('GET', cmsUrl + '/api/profile/' + profileId + '/notifications', true);
            xhr.setRequestHeader('Authorization', 'Bearer ' + token);
            xhr.timeout = 15000;
            xhr.onload = function() {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        var resp = JSON.parse(xhr.responseText);
                        if (resp.success) callback(null, resp);
                        else callback(new Error(resp.error || 'Failed'));
                    } catch(e) { callback(new Error('Invalid response')); }
                } else { callback(new Error('HTTP ' + xhr.status)); }
            };
            xhr.onerror = function() { callback(new Error('Network error')); };
            xhr.ontimeout = function() { callback(new Error('Timeout')); };
            xhr.send();
        },

        markNotificationRead: function(notificationId, callback) {
            var token = this.getCmsAuthToken();
            if (!token) return callback(new Error('Not logged in'));
            var cmsUrl = this.getCmsUrl();
            var xhr = new XMLHttpRequest();
            xhr.open('PUT', cmsUrl + '/api/profile/notifications/' + notificationId + '/read', true);
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.setRequestHeader('Authorization', 'Bearer ' + token);
            xhr.timeout = 15000;
            xhr.onload = function() {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try { callback(null, JSON.parse(xhr.responseText)); } catch(e) { callback(new Error('Invalid response')); }
                } else { callback(new Error('HTTP ' + xhr.status)); }
            };
            xhr.onerror = function() { callback(new Error('Network error')); };
            xhr.ontimeout = function() { callback(new Error('Timeout')); };
            xhr.send();
        },

        archiveNotification: function(notificationId, callback) {
            var token = this.getCmsAuthToken();
            if (!token) return callback(new Error('Not logged in'));
            var cmsUrl = this.getCmsUrl();
            var xhr = new XMLHttpRequest();
            xhr.open('PUT', cmsUrl + '/api/profile/notifications/' + notificationId + '/archive', true);
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.setRequestHeader('Authorization', 'Bearer ' + token);
            xhr.timeout = 15000;
            xhr.onload = function() {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try { callback(null, JSON.parse(xhr.responseText)); } catch(e) { callback(new Error('Invalid response')); }
                } else { callback(new Error('HTTP ' + xhr.status)); }
            };
            xhr.onerror = function() { callback(new Error('Network error')); };
            xhr.ontimeout = function() { callback(new Error('Timeout')); };
            xhr.send();
        },

        deleteNotification: function(notificationId, callback) {
            var token = this.getCmsAuthToken();
            if (!token) return callback(new Error('Not logged in'));
            var cmsUrl = this.getCmsUrl();
            var xhr = new XMLHttpRequest();
            xhr.open('DELETE', cmsUrl + '/api/profile/notifications/' + notificationId, true);
            xhr.setRequestHeader('Authorization', 'Bearer ' + token);
            xhr.timeout = 15000;
            xhr.onload = function() {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try { callback(null, JSON.parse(xhr.responseText)); } catch(e) { callback(new Error('Invalid response')); }
                } else { callback(new Error('HTTP ' + xhr.status)); }
            };
            xhr.onerror = function() { callback(new Error('Network error')); };
            xhr.ontimeout = function() { callback(new Error('Timeout')); };
            xhr.send();
        },

        getArchivedNotifications: function(profileId, callback) {
            var token = this.getCmsAuthToken();
            if (!token) return callback(new Error('Not logged in'));
            var cmsUrl = this.getCmsUrl();
            var xhr = new XMLHttpRequest();
            xhr.open('GET', cmsUrl + '/api/profile/' + profileId + '/notifications?archived=true', true);
            xhr.setRequestHeader('Authorization', 'Bearer ' + token);
            xhr.timeout = 15000;
            xhr.onload = function() {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        var resp = JSON.parse(xhr.responseText);
                        if (resp.success) callback(null, resp);
                        else callback(new Error(resp.error || 'Failed'));
                    } catch(e) { callback(new Error('Invalid response')); }
                } else { callback(new Error('HTTP ' + xhr.status)); }
            };
            xhr.onerror = function() { callback(new Error('Network error')); };
            xhr.ontimeout = function() { callback(new Error('Timeout')); };
            xhr.send();
        },

        getRooms: function(params, callback) {
            var token = this.getCmsAuthToken();
            var cmsUrl = this.getCmsUrl();
            var qs = [];
            if (params) {
                if (params.upcoming) qs.push('upcoming=true');
                if (params.game_id) qs.push('game_id=' + encodeURIComponent(params.game_id));
                if (params.status) qs.push('status=' + encodeURIComponent(params.status));
                if (params.page) qs.push('page=' + encodeURIComponent(params.page));
            }
            var url = cmsUrl + '/api/rooms' + (qs.length ? '?' + qs.join('&') : '');
            var xhr = new XMLHttpRequest();
            xhr.open('GET', url, true);
            if (token) xhr.setRequestHeader('Authorization', 'Bearer ' + token);
            xhr.timeout = 15000;
            xhr.onload = function() {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        var resp = JSON.parse(xhr.responseText);
                        callback(null, resp);
                    } catch(e) { callback(new Error('Invalid response')); }
                } else { callback(new Error('HTTP ' + xhr.status)); }
            };
            xhr.onerror = function() { callback(new Error('Network error')); };
            xhr.ontimeout = function() { callback(new Error('Timeout')); };
            xhr.send();
        },

        getRoom: function(id, callback) {
            var token = this.getCmsAuthToken();
            var cmsUrl = this.getCmsUrl();
            var xhr = new XMLHttpRequest();
            xhr.open('GET', cmsUrl + '/api/rooms/' + id, true);
            if (token) xhr.setRequestHeader('Authorization', 'Bearer ' + token);
            xhr.timeout = 15000;
            xhr.onload = function() {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        var resp = JSON.parse(xhr.responseText);
                        callback(null, resp);
                    } catch(e) { callback(new Error('Invalid response')); }
                } else { callback(new Error('HTTP ' + xhr.status)); }
            };
            xhr.onerror = function() { callback(new Error('Network error')); };
            xhr.ontimeout = function() { callback(new Error('Timeout')); };
            xhr.send();
        },

        createRoom: function(data, callback) {
            var token = this.getCmsAuthToken();
            if (!token) return callback(new Error('Not logged in'));
            var cmsUrl = this.getCmsUrl();
            var xhr = new XMLHttpRequest();
            xhr.open('POST', cmsUrl + '/api/rooms', true);
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.setRequestHeader('Authorization', 'Bearer ' + token);
            xhr.timeout = 15000;
            xhr.onload = function() {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        var resp = JSON.parse(xhr.responseText);
                        callback(null, resp);
                    } catch(e) { callback(new Error('Invalid response')); }
                } else {
                    try {
                        var errResp = JSON.parse(xhr.responseText);
                        callback(new Error(errResp.error || 'HTTP ' + xhr.status));
                    } catch(e) { callback(new Error('HTTP ' + xhr.status)); }
                }
            };
            xhr.onerror = function() { callback(new Error('Network error')); };
            xhr.ontimeout = function() { callback(new Error('Timeout')); };
            xhr.send(JSON.stringify(data));
        },

        joinRoom: function(id, callback) {
            var token = this.getCmsAuthToken();
            if (!token) return callback(new Error('Not logged in'));
            var cmsUrl = this.getCmsUrl();
            var xhr = new XMLHttpRequest();
            xhr.open('POST', cmsUrl + '/api/rooms/' + id + '/join', true);
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.setRequestHeader('Authorization', 'Bearer ' + token);
            xhr.timeout = 15000;
            xhr.onload = function() {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try { callback(null, JSON.parse(xhr.responseText)); } catch(e) { callback(new Error('Invalid response')); }
                } else {
                    try { var r = JSON.parse(xhr.responseText); callback(new Error(r.error || 'HTTP ' + xhr.status)); } catch(e) { callback(new Error('HTTP ' + xhr.status)); }
                }
            };
            xhr.onerror = function() { callback(new Error('Network error')); };
            xhr.ontimeout = function() { callback(new Error('Timeout')); };
            xhr.send();
        },

        leaveRoom: function(id, callback) {
            var token = this.getCmsAuthToken();
            if (!token) return callback(new Error('Not logged in'));
            var cmsUrl = this.getCmsUrl();
            var xhr = new XMLHttpRequest();
            xhr.open('POST', cmsUrl + '/api/rooms/' + id + '/leave', true);
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.setRequestHeader('Authorization', 'Bearer ' + token);
            xhr.timeout = 15000;
            xhr.onload = function() {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try { callback(null, JSON.parse(xhr.responseText)); } catch(e) { callback(new Error('Invalid response')); }
                } else {
                    try { var r = JSON.parse(xhr.responseText); callback(new Error(r.error || 'HTTP ' + xhr.status)); } catch(e) { callback(new Error('HTTP ' + xhr.status)); }
                }
            };
            xhr.onerror = function() { callback(new Error('Network error')); };
            xhr.ontimeout = function() { callback(new Error('Timeout')); };
            xhr.send();
        },

        inviteFriends: function(roomId, friendIds, callback) {
            var token = this.getCmsAuthToken();
            if (!token) return callback(new Error('Not logged in'));
            var cmsUrl = this.getCmsUrl();
            var xhr = new XMLHttpRequest();
            xhr.open('POST', cmsUrl + '/api/rooms/' + roomId + '/invite', true);
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.setRequestHeader('Authorization', 'Bearer ' + token);
            xhr.timeout = 15000;
            xhr.onload = function() {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try { callback(null, JSON.parse(xhr.responseText)); } catch(e) { callback(new Error('Invalid response')); }
                } else {
                    try { var r = JSON.parse(xhr.responseText); callback(new Error(r.error || 'HTTP ' + xhr.status)); } catch(e) { callback(new Error('HTTP ' + xhr.status)); }
                }
            };
            xhr.onerror = function() { callback(new Error('Network error')); };
            xhr.ontimeout = function() { callback(new Error('Timeout')); };
            xhr.send(JSON.stringify({ friend_ids: friendIds }));
        },

        getRoomMessages: function(roomId, afterId, callback) {
            var cmsUrl = this.getCmsUrl();
            var token = this.getCmsAuthToken();
            var url = cmsUrl + '/api/rooms/' + roomId + '/messages';
            if (afterId) url += '?after=' + afterId;
            var xhr = new XMLHttpRequest();
            xhr.open('GET', url, true);
            if (token) xhr.setRequestHeader('Authorization', 'Bearer ' + token);
            xhr.timeout = 15000;
            xhr.onload = function() {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try { callback(null, JSON.parse(xhr.responseText)); } catch(e) { callback(new Error('Invalid response')); }
                } else { callback(new Error('HTTP ' + xhr.status)); }
            };
            xhr.onerror = function() { callback(new Error('Network error')); };
            xhr.ontimeout = function() { callback(new Error('Timeout')); };
            xhr.send();
        },

        sendRoomMessage: function(roomId, message, callback) {
            var token = this.getCmsAuthToken();
            if (!token) return callback(new Error('Not logged in'));
            var cmsUrl = this.getCmsUrl();
            var xhr = new XMLHttpRequest();
            xhr.open('POST', cmsUrl + '/api/rooms/' + roomId + '/messages', true);
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.setRequestHeader('Authorization', 'Bearer ' + token);
            xhr.timeout = 15000;
            xhr.onload = function() {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try { callback(null, JSON.parse(xhr.responseText)); } catch(e) { callback(new Error('Invalid response')); }
                } else {
                    try { var r = JSON.parse(xhr.responseText); callback(new Error(r.error || 'HTTP ' + xhr.status)); } catch(e) { callback(new Error('HTTP ' + xhr.status)); }
                }
            };
            xhr.onerror = function() { callback(new Error('Network error')); };
            xhr.ontimeout = function() { callback(new Error('Timeout')); };
            xhr.send(JSON.stringify({ message: message }));
        },

        finishRoom: function(id, callback) {
            var token = this.getCmsAuthToken();
            if (!token) return callback(new Error('Not logged in'));
            var cmsUrl = this.getCmsUrl();
            var xhr = new XMLHttpRequest();
            xhr.open('PUT', cmsUrl + '/api/rooms/' + id + '/finish', true);
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.setRequestHeader('Authorization', 'Bearer ' + token);
            xhr.timeout = 15000;
            xhr.onload = function() {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try { callback(null, JSON.parse(xhr.responseText)); } catch(e) { callback(new Error('Invalid response')); }
                } else {
                    try { var r = JSON.parse(xhr.responseText); callback(new Error(r.error || 'HTTP ' + xhr.status)); } catch(e) { callback(new Error('HTTP ' + xhr.status)); }
                }
            };
            xhr.onerror = function() { callback(new Error('Network error')); };
            xhr.ontimeout = function() { callback(new Error('Timeout')); };
            xhr.send();
        },

        updateRoom: function(id, data, callback) {
            var token = this.getCmsAuthToken();
            if (!token) return callback(new Error('Not logged in'));
            var cmsUrl = this.getCmsUrl();
            var xhr = new XMLHttpRequest();
            xhr.open('PUT', cmsUrl + '/api/rooms/' + id, true);
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.setRequestHeader('Authorization', 'Bearer ' + token);
            xhr.timeout = 15000;
            xhr.onload = function() {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try { callback(null, JSON.parse(xhr.responseText)); } catch(e) { callback(new Error('Invalid response')); }
                } else {
                    try { var r = JSON.parse(xhr.responseText); callback(new Error(r.error || 'HTTP ' + xhr.status)); } catch(e) { callback(new Error('HTTP ' + xhr.status)); }
                }
            };
            xhr.onerror = function() { callback(new Error('Network error')); };
            xhr.ontimeout = function() { callback(new Error('Timeout')); };
            xhr.send(JSON.stringify(data));
        },

        getMyRooms: function(callback) {
            var token = this.getCmsAuthToken();
            if (!token) return callback(new Error('Not logged in'));
            var cmsUrl = this.getCmsUrl();
            var xhr = new XMLHttpRequest();
            xhr.open('GET', cmsUrl + '/api/rooms/my', true);
            xhr.setRequestHeader('Authorization', 'Bearer ' + token);
            xhr.timeout = 15000;
            xhr.onload = function() {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try { callback(null, JSON.parse(xhr.responseText)); } catch(e) { callback(new Error('Invalid response')); }
                } else { callback(new Error('HTTP ' + xhr.status)); }
            };
            xhr.onerror = function() { callback(new Error('Network error')); };
            xhr.ontimeout = function() { callback(new Error('Timeout')); };
            xhr.send();
        },

        getFriendsList: function(profileId, callback) {
            var token = this.getCmsAuthToken();
            if (!token) return callback(new Error('Not logged in'));
            var cmsUrl = this.getCmsUrl();
            var xhr = new XMLHttpRequest();
            xhr.open('GET', cmsUrl + '/api/profile/' + profileId + '/friends', true);
            xhr.setRequestHeader('Authorization', 'Bearer ' + token);
            xhr.timeout = 15000;
            xhr.onload = function() {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        var resp = JSON.parse(xhr.responseText);
                        callback(null, resp);
                    } catch(e) { callback(new Error('Invalid response')); }
                } else { callback(new Error('HTTP ' + xhr.status)); }
            };
            xhr.onerror = function() { callback(new Error('Network error')); };
            xhr.ontimeout = function() { callback(new Error('Timeout')); };
            xhr.send();
        },

        getGameComments: function(titleId, page, callback) {
            var cmsUrl = this.getCmsUrl();
            var url = cmsUrl + '/api/games/' + encodeURIComponent(titleId) + '/comments?page=' + (page || 1);
            var xhr = new XMLHttpRequest();
            xhr.open('GET', url, true);
            xhr.timeout = 15000;
            xhr.onload = function() {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        var resp = JSON.parse(xhr.responseText);
                        if (resp.success) callback(null, resp);
                        else callback(new Error(resp.error || 'Failed'));
                    } catch(e) { callback(new Error('Invalid response')); }
                } else { callback(new Error('HTTP ' + xhr.status)); }
            };
            xhr.onerror = function() { callback(new Error('Network error')); };
            xhr.ontimeout = function() { callback(new Error('Timeout')); };
            xhr.send();
        },

        addGameComment: function(titleId, commentText, gameTitle, callback, coverImageUrl) {
            var token = this.getCmsAuthToken();
            if (!token) return callback(new Error('Not logged in'));
            var cmsUrl = this.getCmsUrl();
            var url = cmsUrl + '/api/games/' + encodeURIComponent(titleId) + '/comments';
            var xhr = new XMLHttpRequest();
            xhr.open('POST', url, true);
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.setRequestHeader('Authorization', 'Bearer ' + token);
            xhr.timeout = 15000;
            xhr.onload = function() {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        var resp = JSON.parse(xhr.responseText);
                        if (resp.success) callback(null, resp.comment);
                        else callback(new Error(resp.error || 'Failed'));
                    } catch(e) { callback(new Error('Invalid response')); }
                } else {
                    try {
                        var errResp = JSON.parse(xhr.responseText);
                        callback(new Error(errResp.error || 'HTTP ' + xhr.status));
                    } catch(e) { callback(new Error('HTTP ' + xhr.status)); }
                }
            };
            xhr.onerror = function() { callback(new Error('Network error')); };
            xhr.ontimeout = function() { callback(new Error('Timeout')); };
            var body = { comment_text: commentText, game_title: gameTitle };
            if (coverImageUrl) body.cover_image_url = coverImageUrl;
            xhr.send(JSON.stringify(body));
        },

        deleteGameComment: function(titleId, commentId, callback) {
            var token = this.getCmsAuthToken();
            if (!token) return callback(new Error('Not logged in'));
            var cmsUrl = this.getCmsUrl();
            var url = cmsUrl + '/api/games/' + encodeURIComponent(titleId) + '/comments/' + commentId;
            var xhr = new XMLHttpRequest();
            xhr.open('DELETE', url, true);
            xhr.setRequestHeader('Authorization', 'Bearer ' + token);
            xhr.timeout = 15000;
            xhr.onload = function() {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        var resp = JSON.parse(xhr.responseText);
                        if (resp.success) callback(null);
                        else callback(new Error(resp.error || 'Failed'));
                    } catch(e) { callback(new Error('Invalid response')); }
                } else { callback(new Error('HTTP ' + xhr.status)); }
            };
            xhr.onerror = function() { callback(new Error('Network error')); };
            xhr.ontimeout = function() { callback(new Error('Timeout')); };
            xhr.send();
        },

        getCmsGameByTitleId: function(titleId, callback) {
            var cleanId = titleId.replace(/^0x/i, '');
            var cmsUrl = this.getCmsUrl();
            if (!cmsUrl) return callback(new Error('CMS URL not configured'));

            var lang = (typeof I18n !== 'undefined' && I18n.getLanguage) ? I18n.getLanguage() : 'pt';
            var url = cmsUrl + '/api/game/by-title-id/' + encodeURIComponent(cleanId) + '?lang=' + encodeURIComponent(lang);
            var xhr = new XMLHttpRequest();
            xhr.open('GET', url, true);
            xhr.timeout = 15000;
            xhr.onload = function() {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        var resp = JSON.parse(xhr.responseText);
                        callback(null, resp.game || null);
                    } catch(e) {
                        callback(new Error('Invalid response'));
                    }
                } else {
                    callback(new Error('HTTP ' + xhr.status));
                }
            };
            xhr.onerror = function() { callback(new Error('Network error')); };
            xhr.ontimeout = function() { callback(new Error('Timeout')); };
            xhr.send();
        },

        getDBoxDescription: function(titleId, callback) {
            var cleanId = titleId.replace(/^0x/i, '');
            var cacheKey = 'nova_dbox_' + cleanId.toUpperCase();
            try {
                var cached = localStorage.getItem(cacheKey);
                if (cached) {
                    var parsed = JSON.parse(cached);
                    if (parsed && (Date.now() - parsed.ts < 7 * 24 * 60 * 60 * 1000)) {
                        return callback(null, parsed.data);
                    }
                }
            } catch(e) {}

            var cmsUrl = this.getCmsUrl();
            if (!cmsUrl) return callback(new Error('CMS URL not configured'));

            var url = cmsUrl + '/api/dbox/description/' + encodeURIComponent(cleanId);
            var xhr = new XMLHttpRequest();
            xhr.open('GET', url, true);
            xhr.timeout = 15000;
            xhr.onload = function() {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        var resp = JSON.parse(xhr.responseText);
                        var data = resp.data || null;
                        try {
                            localStorage.setItem(cacheKey, JSON.stringify({ data: data, ts: Date.now() }));
                        } catch(e) {}
                        callback(null, data);
                    } catch(e) {
                        callback(new Error('Invalid response'));
                    }
                } else {
                    callback(new Error('HTTP ' + xhr.status));
                }
            };
            xhr.onerror = function() { callback(new Error('Network error')); };
            xhr.ontimeout = function() { callback(new Error('Timeout')); };
            xhr.send();
        },

        registerPushSubscription: function(callback) {
            var self = this;
            if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
                return callback && callback(new Error('Push not supported'));
            }

            var cmsUrl = this.getCmsUrl();
            var token = this.getCmsAuthToken();
            if (!token) return callback && callback(new Error('Not logged in'));

            var vapidXhr = new XMLHttpRequest();
            vapidXhr.open('GET', cmsUrl + '/api/push/vapid-key', true);
            vapidXhr.onload = function() {
                if (vapidXhr.status !== 200) return callback && callback(new Error('Failed to get VAPID key'));
                try {
                    var resp = JSON.parse(vapidXhr.responseText);
                    var vapidKey = resp.publicKey;
                    if (!vapidKey) return callback && callback(new Error('No VAPID key'));

                    navigator.serviceWorker.register('/nova-webui/sw.js').then(function(reg) {
                        return reg.pushManager.getSubscription().then(function(sub) {
                            if (sub) return sub;
                            var converted = self._urlBase64ToUint8Array(vapidKey);
                            return reg.pushManager.subscribe({
                                userVisibleOnly: true,
                                applicationServerKey: converted
                            });
                        });
                    }).then(function(subscription) {
                        var subXhr = new XMLHttpRequest();
                        subXhr.open('POST', cmsUrl + '/api/profile/push/subscribe', true);
                        subXhr.setRequestHeader('Content-Type', 'application/json');
                        subXhr.setRequestHeader('Authorization', 'Bearer ' + token);
                        subXhr.onload = function() {
                            callback && callback(null, true);
                        };
                        subXhr.onerror = function() {
                            callback && callback(new Error('Failed to save subscription'));
                        };
                        subXhr.send(JSON.stringify({ subscription: subscription.toJSON() }));
                    }).catch(function(err) {
                        callback && callback(err);
                    });
                } catch(e) {
                    callback && callback(e);
                }
            };
            vapidXhr.onerror = function() { callback && callback(new Error('Network error')); };
            vapidXhr.send();
        },

        sendFriendRequest: function(targetProfileId, callback) {
            var token = this.getCmsAuthToken();
            if (!token) return callback(new Error('Not logged in'));
            var cmsUrl = this.getCmsUrl();
            var xhr = new XMLHttpRequest();
            xhr.open('POST', cmsUrl + '/api/profile/' + targetProfileId + '/friends', true);
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.setRequestHeader('Authorization', 'Bearer ' + token);
            xhr.timeout = 15000;
            xhr.onload = function() {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try { callback(null, JSON.parse(xhr.responseText)); } catch(e) { callback(new Error('Invalid response')); }
                } else {
                    try { var r = JSON.parse(xhr.responseText); callback(new Error(r.error || 'HTTP ' + xhr.status)); } catch(e) { callback(new Error('HTTP ' + xhr.status)); }
                }
            };
            xhr.onerror = function() { callback(new Error('Network error')); };
            xhr.ontimeout = function() { callback(new Error('Timeout')); };
            xhr.send();
        },

        respondFriendRequest: function(friendshipId, status, callback) {
            var token = this.getCmsAuthToken();
            if (!token) return callback(new Error('Not logged in'));
            var cmsUrl = this.getCmsUrl();
            var xhr = new XMLHttpRequest();
            xhr.open('PUT', cmsUrl + '/api/profile/friends/' + friendshipId, true);
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.setRequestHeader('Authorization', 'Bearer ' + token);
            xhr.timeout = 15000;
            xhr.onload = function() {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try { callback(null, JSON.parse(xhr.responseText)); } catch(e) { callback(new Error('Invalid response')); }
                } else {
                    try { var r = JSON.parse(xhr.responseText); callback(new Error(r.error || 'HTTP ' + xhr.status)); } catch(e) { callback(new Error('HTTP ' + xhr.status)); }
                }
            };
            xhr.onerror = function() { callback(new Error('Network error')); };
            xhr.ontimeout = function() { callback(new Error('Timeout')); };
            xhr.send(JSON.stringify({ status: status }));
        },

        removeFriend: function(friendshipId, callback) {
            var token = this.getCmsAuthToken();
            if (!token) return callback(new Error('Not logged in'));
            var cmsUrl = this.getCmsUrl();
            var xhr = new XMLHttpRequest();
            xhr.open('DELETE', cmsUrl + '/api/profile/friends/' + friendshipId, true);
            xhr.setRequestHeader('Authorization', 'Bearer ' + token);
            xhr.timeout = 15000;
            xhr.onload = function() {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try { callback(null, JSON.parse(xhr.responseText)); } catch(e) { callback(new Error('Invalid response')); }
                } else {
                    try { var r = JSON.parse(xhr.responseText); callback(new Error(r.error || 'HTTP ' + xhr.status)); } catch(e) { callback(new Error('HTTP ' + xhr.status)); }
                }
            };
            xhr.onerror = function() { callback(new Error('Network error')); };
            xhr.ontimeout = function() { callback(new Error('Timeout')); };
            xhr.send();
        },

        setPrimaryXuid: function(xuid, gamertag, callback) {
            var token = this.getCmsAuthToken();
            if (!token) return callback(new Error('Not logged in'));
            var cmsUrl = this.getCmsUrl();
            var xhr = new XMLHttpRequest();
            xhr.open('POST', cmsUrl + '/api/profile/set-primary-xuid', true);
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.setRequestHeader('Authorization', 'Bearer ' + token);
            xhr.timeout = 15000;
            xhr.onload = function() {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try { callback(null, JSON.parse(xhr.responseText)); } catch(e) { callback(new Error('Invalid response')); }
                } else {
                    try { var r = JSON.parse(xhr.responseText); callback(new Error(r.error || 'HTTP ' + xhr.status)); } catch(e) { callback(new Error('HTTP ' + xhr.status)); }
                }
            };
            xhr.onerror = function() { callback(new Error('Network error')); };
            xhr.ontimeout = function() { callback(new Error('Timeout')); };
            xhr.send(JSON.stringify({ xuid: xuid, gamertag: gamertag }));
        },

        lookupByFriendCode: function(code, callback) {
            var cmsUrl = this.getCmsUrl();
            var xhr = new XMLHttpRequest();
            xhr.open('GET', cmsUrl + '/api/profile/lookup?code=' + encodeURIComponent(code), true);
            xhr.timeout = 15000;
            xhr.onload = function() {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        var resp = JSON.parse(xhr.responseText);
                        if (resp.success) callback(null, resp.profile);
                        else callback(new Error(resp.error || 'Not found'));
                    } catch(e) { callback(new Error('Invalid response')); }
                } else {
                    try { var r = JSON.parse(xhr.responseText); callback(new Error(r.error || 'HTTP ' + xhr.status)); } catch(e) { callback(new Error('HTTP ' + xhr.status)); }
                }
            };
            xhr.onerror = function() { callback(new Error('Network error')); };
            xhr.ontimeout = function() { callback(new Error('Timeout')); };
            xhr.send();
        },

        checkOnline: function(callback) {
            var cmsUrl = this.getCmsUrl();
            if (!cmsUrl) return callback(false);
            var xhr = new XMLHttpRequest();
            xhr.open('HEAD', cmsUrl + '/api/ping', true);
            xhr.timeout = 5000;
            xhr.onload = function() { callback(xhr.status >= 200 && xhr.status < 500); };
            xhr.onerror = function() { callback(false); };
            xhr.ontimeout = function() { callback(false); };
            try { xhr.send(); } catch(e) { callback(false); }
        },

        getStixAchievements: function(profileId, callback) {
            var cmsUrl = this.getCmsUrl();
            if (!cmsUrl) return callback(new Error('CMS not configured'));
            var token = this.getCmsAuthToken();
            var url = cmsUrl + '/api/profile/' + profileId + '/achievements/stix';
            var xhr = new XMLHttpRequest();
            xhr.open('GET', url, true);
            if (token) xhr.setRequestHeader('Authorization', 'Bearer ' + token);
            xhr.timeout = 15000;
            xhr.onload = function() {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        var resp = JSON.parse(xhr.responseText);
                        if (resp.success) callback(null, resp);
                        else callback(new Error(resp.error || 'Failed'));
                    } catch(e) { callback(new Error('Invalid response')); }
                } else { callback(new Error('HTTP ' + xhr.status)); }
            };
            xhr.onerror = function() { callback(new Error('Network error')); };
            xhr.ontimeout = function() { callback(new Error('Timeout')); };
            xhr.send();
        },

        checkFavorite: function(gameId, userId, callback) {
            var cmsUrl = this.getCmsUrl();
            if (!cmsUrl) return callback(new Error('CMS not configured'));
            var url = cmsUrl + '/api/favorites/check?game_id=' + gameId + '&user_id=' + userId;
            var xhr = new XMLHttpRequest();
            xhr.open('GET', url, true);
            xhr.timeout = 15000;
            xhr.onload = function() {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        var resp = JSON.parse(xhr.responseText);
                        callback(null, resp);
                    } catch(e) { callback(new Error('Invalid response')); }
                } else { callback(new Error('HTTP ' + xhr.status)); }
            };
            xhr.onerror = function() { callback(new Error('Network error')); };
            xhr.ontimeout = function() { callback(new Error('Timeout')); };
            xhr.send();
        },

        addFavorite: function(gameId, userId, callback) {
            var cmsUrl = this.getCmsUrl();
            if (!cmsUrl) return callback(new Error('CMS not configured'));
            var url = cmsUrl + '/api/favorites/add?game_id=' + gameId + '&user_id=' + userId;
            var xhr = new XMLHttpRequest();
            xhr.open('GET', url, true);
            xhr.timeout = 15000;
            xhr.onload = function() {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        var resp = JSON.parse(xhr.responseText);
                        callback(null, resp);
                    } catch(e) { callback(new Error('Invalid response')); }
                } else { callback(new Error('HTTP ' + xhr.status)); }
            };
            xhr.onerror = function() { callback(new Error('Network error')); };
            xhr.ontimeout = function() { callback(new Error('Timeout')); };
            xhr.send();
        },

        removeFavorite: function(gameId, userId, callback) {
            var cmsUrl = this.getCmsUrl();
            if (!cmsUrl) return callback(new Error('CMS not configured'));
            var url = cmsUrl + '/api/favorites/remove?game_id=' + gameId + '&user_id=' + userId;
            var xhr = new XMLHttpRequest();
            xhr.open('GET', url, true);
            xhr.timeout = 15000;
            xhr.onload = function() {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        var resp = JSON.parse(xhr.responseText);
                        callback(null, resp);
                    } catch(e) { callback(new Error('Invalid response')); }
                } else { callback(new Error('HTTP ' + xhr.status)); }
            };
            xhr.onerror = function() { callback(new Error('Network error')); };
            xhr.ontimeout = function() { callback(new Error('Timeout')); };
            xhr.send();
        },

        listFavorites: function(userId, callback) {
            var cmsUrl = this.getCmsUrl();
            if (!cmsUrl) return callback(new Error('CMS not configured'));
            var url = cmsUrl + '/api/favorites?user_id=' + userId;
            var xhr = new XMLHttpRequest();
            xhr.open('GET', url, true);
            xhr.timeout = 15000;
            xhr.onload = function() {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        var resp = JSON.parse(xhr.responseText);
                        callback(null, resp);
                    } catch(e) { callback(new Error('Invalid response')); }
                } else { callback(new Error('HTTP ' + xhr.status)); }
            };
            xhr.onerror = function() { callback(new Error('Network error')); };
            xhr.ontimeout = function() { callback(new Error('Timeout')); };
            xhr.send();
        },

        getPopularGames: function(callback) {
            var cmsUrl = this.getCmsUrl();
            if (!cmsUrl) return callback(new Error('CMS not configured'));
            var url = cmsUrl + '/api/games-popular?limit=12';
            var xhr = new XMLHttpRequest();
            xhr.open('GET', url, true);
            xhr.timeout = 15000;
            xhr.onload = function() {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        var resp = JSON.parse(xhr.responseText);
                        callback(null, resp);
                    } catch(e) { callback(new Error('Invalid response')); }
                } else { callback(new Error('HTTP ' + xhr.status)); }
            };
            xhr.onerror = function() { callback(new Error('Network error')); };
            xhr.ontimeout = function() { callback(new Error('Timeout')); };
            xhr.send();
        },

        getCmsGames: function(options, callback) {
            var cmsUrl = this.getCmsUrl();
            if (!cmsUrl) return callback(new Error('CMS not configured'));
            var params = [];
            if (options.limit) params.push('limit=' + options.limit);
            if (options.page) params.push('page=' + options.page);
            if (options.search) params.push('search=' + encodeURIComponent(options.search));
            if (options.platform) params.push('platform=' + encodeURIComponent(options.platform));
            if (options.sort) params.push('sort=' + encodeURIComponent(options.sort));
            var url = cmsUrl + '/api/games' + (params.length ? '?' + params.join('&') : '');
            var token = this.getCmsAuthToken();
            var xhr = new XMLHttpRequest();
            xhr.open('GET', url, true);
            if (token) xhr.setRequestHeader('Authorization', 'Bearer ' + token);
            xhr.timeout = 15000;
            xhr.onload = function() {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        var resp = JSON.parse(xhr.responseText);
                        callback(null, resp);
                    } catch(e) { callback(new Error('Invalid response')); }
                } else { callback(new Error('HTTP ' + xhr.status)); }
            };
            xhr.onerror = function() { callback(new Error('Network error')); };
            xhr.ontimeout = function() { callback(new Error('Timeout')); };
            xhr.send();
        },

        cmsUpdateOnlineStatus: function(isOnline, gameTitle, callback) {
            var token = this.getCmsAuthToken();
            if (!token) return (callback && callback(new Error('Not logged in')));
            var cmsUrl = this.getCmsUrl();
            if (!cmsUrl) return (callback && callback(new Error('CMS not configured')));
            var url = cmsUrl + '/api/profile/online-status';
            var xhr = new XMLHttpRequest();
            xhr.open('POST', url, true);
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.setRequestHeader('Authorization', 'Bearer ' + token);
            xhr.timeout = 10000;
            xhr.onload = function() {
                if (callback) {
                    if (xhr.status >= 200 && xhr.status < 300) callback(null);
                    else callback(new Error('HTTP ' + xhr.status));
                }
            };
            xhr.onerror = function() { if (callback) callback(new Error('Network error')); };
            xhr.ontimeout = function() { if (callback) callback(new Error('Timeout')); };
            xhr.send(JSON.stringify({ is_online: isOnline, current_game_title: gameTitle || null }));
        },

        uploadAvatar: function(profileId, file, callback) {
            var token = this.getCmsAuthToken();
            if (!token) return callback(new Error('Not logged in'));
            var cmsUrl = this.getCmsUrl();
            if (!cmsUrl) return callback(new Error('CMS not configured'));
            var url = cmsUrl + '/api/profile/' + profileId + '/avatar';
            var formData = new FormData();
            formData.append('avatar', file);
            var xhr = new XMLHttpRequest();
            xhr.open('POST', url, true);
            xhr.setRequestHeader('Authorization', 'Bearer ' + token);
            xhr.timeout = 60000;
            xhr.onload = function() {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        var resp = JSON.parse(xhr.responseText);
                        if (resp.success) callback(null, resp);
                        else callback(new Error(resp.error || 'Upload failed'));
                    } catch(e) { callback(new Error('Invalid response')); }
                } else {
                    try {
                        var errResp = JSON.parse(xhr.responseText);
                        callback(new Error(errResp.error || 'HTTP ' + xhr.status));
                    } catch(e) { callback(new Error('HTTP ' + xhr.status)); }
                }
            };
            xhr.onerror = function() { callback(new Error('Network error')); };
            xhr.ontimeout = function() { callback(new Error('Timeout')); };
            xhr.send(formData);
        },

        uploadCover: function(profileId, file, callback) {
            var token = this.getCmsAuthToken();
            if (!token) return callback(new Error('Not logged in'));
            var cmsUrl = this.getCmsUrl();
            if (!cmsUrl) return callback(new Error('CMS not configured'));
            var url = cmsUrl + '/api/profile/' + profileId + '/cover';
            var formData = new FormData();
            formData.append('cover', file);
            var xhr = new XMLHttpRequest();
            xhr.open('POST', url, true);
            xhr.setRequestHeader('Authorization', 'Bearer ' + token);
            xhr.timeout = 60000;
            xhr.onload = function() {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        var resp = JSON.parse(xhr.responseText);
                        if (resp.success) callback(null, resp);
                        else callback(new Error(resp.error || 'Upload failed'));
                    } catch(e) { callback(new Error('Invalid response')); }
                } else {
                    try {
                        var errResp = JSON.parse(xhr.responseText);
                        callback(new Error(errResp.error || 'HTTP ' + xhr.status));
                    } catch(e) { callback(new Error('HTTP ' + xhr.status)); }
                }
            };
            xhr.onerror = function() { callback(new Error('Network error')); };
            xhr.ontimeout = function() { callback(new Error('Timeout')); };
            xhr.send(formData);
        },

        cmsUpdateProfile: function(profileId, data, callback) {
            var token = this.getCmsAuthToken();
            if (!token) return callback(new Error('Not logged in'));
            var cmsUrl = this.getCmsUrl();
            if (!cmsUrl) return callback(new Error('CMS not configured'));
            var url = cmsUrl + '/api/profile/' + profileId;
            var xhr = new XMLHttpRequest();
            xhr.open('PUT', url, true);
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.setRequestHeader('Authorization', 'Bearer ' + token);
            xhr.timeout = 15000;
            xhr.onload = function() {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        var resp = JSON.parse(xhr.responseText);
                        callback(null, resp);
                    } catch(e) { callback(new Error('Invalid response')); }
                } else { callback(new Error('HTTP ' + xhr.status)); }
            };
            xhr.onerror = function() { callback(new Error('Network error')); };
            xhr.ontimeout = function() { callback(new Error('Timeout')); };
            xhr.send(JSON.stringify(data));
        },

        getEvents: function(callback) {
            var cmsUrl = this.getCmsUrl();
            if (!cmsUrl) return callback(new Error('CMS not configured'));
            var lang = (typeof I18n !== 'undefined' && I18n.getLanguage) ? I18n.getLanguage() : 'pt';
            var url = cmsUrl + '/api/events?lang=' + encodeURIComponent(lang);
            var xhr = new XMLHttpRequest();
            xhr.open('GET', url, true);
            xhr.timeout = 15000;
            var token = this.getCmsAuthToken();
            if (token) xhr.setRequestHeader('Authorization', 'Bearer ' + token);
            xhr.onload = function() {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        var resp = JSON.parse(xhr.responseText);
                        callback(null, resp);
                    } catch(e) { callback(new Error('Invalid response')); }
                } else { callback(new Error('HTTP ' + xhr.status)); }
            };
            xhr.onerror = function() { callback(new Error('Network error')); };
            xhr.ontimeout = function() { callback(new Error('Timeout')); };
            xhr.send();
        },

        getBlogComments: function(postId, page, callback) {
            var cmsUrl = this.getCmsUrl();
            var url = cmsUrl + '/api/blog/posts/' + postId + '/comments?page=' + (page || 1);
            var xhr = new XMLHttpRequest();
            xhr.open('GET', url, true);
            xhr.timeout = 15000;
            xhr.onload = function() {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        var resp = JSON.parse(xhr.responseText);
                        if (resp.success) callback(null, resp);
                        else callback(new Error(resp.error || 'Failed'));
                    } catch(e) { callback(new Error('Invalid response')); }
                } else { callback(new Error('HTTP ' + xhr.status)); }
            };
            xhr.onerror = function() { callback(new Error('Network error')); };
            xhr.ontimeout = function() { callback(new Error('Timeout')); };
            xhr.send();
        },

        addBlogComment: function(postId, commentText, callback) {
            var token = this.getCmsAuthToken();
            if (!token) return callback(new Error('Not logged in'));
            var cmsUrl = this.getCmsUrl();
            var url = cmsUrl + '/api/blog/posts/' + postId + '/comments';
            var xhr = new XMLHttpRequest();
            xhr.open('POST', url, true);
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.setRequestHeader('Authorization', 'Bearer ' + token);
            xhr.timeout = 15000;
            xhr.onload = function() {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        var resp = JSON.parse(xhr.responseText);
                        if (resp.success) callback(null, resp.comment);
                        else callback(new Error(resp.error || 'Failed'));
                    } catch(e) { callback(new Error('Invalid response')); }
                } else {
                    try {
                        var errResp = JSON.parse(xhr.responseText);
                        callback(new Error(errResp.error || 'HTTP ' + xhr.status));
                    } catch(e) { callback(new Error('HTTP ' + xhr.status)); }
                }
            };
            xhr.onerror = function() { callback(new Error('Network error')); };
            xhr.ontimeout = function() { callback(new Error('Timeout')); };
            xhr.send(JSON.stringify({ comment_text: commentText }));
        },

        deleteBlogComment: function(postId, commentId, callback) {
            var token = this.getCmsAuthToken();
            if (!token) return callback(new Error('Not logged in'));
            var cmsUrl = this.getCmsUrl();
            var url = cmsUrl + '/api/blog/posts/' + postId + '/comments/' + commentId;
            var xhr = new XMLHttpRequest();
            xhr.open('DELETE', url, true);
            xhr.setRequestHeader('Authorization', 'Bearer ' + token);
            xhr.timeout = 15000;
            xhr.onload = function() {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        var resp = JSON.parse(xhr.responseText);
                        if (resp.success) callback(null);
                        else callback(new Error(resp.error || 'Failed'));
                    } catch(e) { callback(new Error('Invalid response')); }
                } else { callback(new Error('HTTP ' + xhr.status)); }
            };
            xhr.onerror = function() { callback(new Error('Network error')); };
            xhr.ontimeout = function() { callback(new Error('Timeout')); };
            xhr.send();
        },

        getBlogPosts: function(callback) {
            var cmsUrl = this.getCmsUrl();
            if (!cmsUrl) return callback(new Error('CMS not configured'));
            var lang = (typeof I18n !== 'undefined' && I18n.getLanguage) ? I18n.getLanguage() : 'pt';
            var url = cmsUrl + '/api/blog/posts?lang=' + encodeURIComponent(lang);
            var xhr = new XMLHttpRequest();
            xhr.open('GET', url, true);
            xhr.timeout = 15000;
            xhr.onload = function() {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        var resp = JSON.parse(xhr.responseText);
                        callback(null, resp);
                    } catch(e) { callback(new Error('Invalid response')); }
                } else { callback(new Error('HTTP ' + xhr.status)); }
            };
            xhr.onerror = function() { callback(new Error('Network error')); };
            xhr.ontimeout = function() { callback(new Error('Timeout')); };
            xhr.send();
        },

        postBlogView: function(postId, callback) {
            var cmsUrl = this.getCmsUrl();
            if (!cmsUrl) return callback(new Error('CMS not configured'));
            var url = cmsUrl + '/api/blog/' + postId + '/view';
            var xhr = new XMLHttpRequest();
            xhr.open('POST', url, true);
            xhr.setRequestHeader('Content-Type', 'application/json');
            var token = this.getCmsAuthToken();
            if (token) xhr.setRequestHeader('Authorization', 'Bearer ' + token);
            xhr.timeout = 15000;
            xhr.onload = function() {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try { callback(null, JSON.parse(xhr.responseText)); } catch(e) { callback(null); }
                } else { callback(new Error('HTTP ' + xhr.status)); }
            };
            xhr.onerror = function() { callback(new Error('Network error')); };
            xhr.ontimeout = function() { callback(new Error('Timeout')); };
            xhr.send();
        },

        postEventView: function(eventId, callback) {
            var cmsUrl = this.getCmsUrl();
            if (!cmsUrl) return callback(new Error('CMS not configured'));
            var url = cmsUrl + '/api/events/' + eventId + '/view';
            var xhr = new XMLHttpRequest();
            xhr.open('POST', url, true);
            xhr.setRequestHeader('Content-Type', 'application/json');
            var token = this.getCmsAuthToken();
            if (token) xhr.setRequestHeader('Authorization', 'Bearer ' + token);
            xhr.timeout = 15000;
            xhr.onload = function() {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try { callback(null, JSON.parse(xhr.responseText)); } catch(e) { callback(null); }
                } else { callback(new Error('HTTP ' + xhr.status)); }
            };
            xhr.onerror = function() { callback(new Error('Network error')); };
            xhr.ontimeout = function() { callback(new Error('Timeout')); };
            xhr.send();
        },

        postEventRsvp: function(eventId, callback) {
            var token = this.getCmsAuthToken();
            if (!token) return callback(new Error('Not logged in'));
            var cmsUrl = this.getCmsUrl();
            if (!cmsUrl) return callback(new Error('CMS not configured'));
            var url = cmsUrl + '/api/events/' + eventId + '/rsvp';
            var xhr = new XMLHttpRequest();
            xhr.open('POST', url, true);
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.setRequestHeader('Authorization', 'Bearer ' + token);
            xhr.timeout = 15000;
            xhr.onload = function() {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try { callback(null, JSON.parse(xhr.responseText)); } catch(e) { callback(new Error('Invalid response')); }
                } else { callback(new Error('HTTP ' + xhr.status)); }
            };
            xhr.onerror = function() { callback(new Error('Network error')); };
            xhr.ontimeout = function() { callback(new Error('Timeout')); };
            xhr.send();
        },

        getEventRsvp: function(eventId, callback) {
            var cmsUrl = this.getCmsUrl();
            if (!cmsUrl) return callback(new Error('CMS not configured'));
            var url = cmsUrl + '/api/events/' + eventId + '/rsvp';
            var xhr = new XMLHttpRequest();
            xhr.open('GET', url, true);
            xhr.timeout = 15000;
            xhr.onload = function() {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try { callback(null, JSON.parse(xhr.responseText)); } catch(e) { callback(new Error('Invalid response')); }
                } else { callback(new Error('HTTP ' + xhr.status)); }
            };
            xhr.onerror = function() { callback(new Error('Network error')); };
            xhr.ontimeout = function() { callback(new Error('Timeout')); };
            xhr.send();
        },

        getEventComments: function(eventId, page, callback) {
            var cmsUrl = this.getCmsUrl();
            if (!cmsUrl) return callback(new Error('CMS not configured'));
            var url = cmsUrl + '/api/events/' + eventId + '/comments?page=' + (page || 1);
            var xhr = new XMLHttpRequest();
            xhr.open('GET', url, true);
            xhr.timeout = 15000;
            xhr.onload = function() {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        var resp = JSON.parse(xhr.responseText);
                        if (resp.success) callback(null, resp);
                        else callback(new Error(resp.error || 'Failed'));
                    } catch(e) { callback(new Error('Invalid response')); }
                } else { callback(new Error('HTTP ' + xhr.status)); }
            };
            xhr.onerror = function() { callback(new Error('Network error')); };
            xhr.ontimeout = function() { callback(new Error('Timeout')); };
            xhr.send();
        },

        addEventComment: function(eventId, commentText, callback) {
            var token = this.getCmsAuthToken();
            if (!token) return callback(new Error('Not logged in'));
            var cmsUrl = this.getCmsUrl();
            var url = cmsUrl + '/api/events/' + eventId + '/comments';
            var xhr = new XMLHttpRequest();
            xhr.open('POST', url, true);
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.setRequestHeader('Authorization', 'Bearer ' + token);
            xhr.timeout = 15000;
            xhr.onload = function() {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        var resp = JSON.parse(xhr.responseText);
                        if (resp.success) callback(null, resp.comment);
                        else callback(new Error(resp.error || 'Failed'));
                    } catch(e) { callback(new Error('Invalid response')); }
                } else {
                    try {
                        var errResp = JSON.parse(xhr.responseText);
                        callback(new Error(errResp.error || 'HTTP ' + xhr.status));
                    } catch(e) { callback(new Error('HTTP ' + xhr.status)); }
                }
            };
            xhr.onerror = function() { callback(new Error('Network error')); };
            xhr.ontimeout = function() { callback(new Error('Timeout')); };
            xhr.send(JSON.stringify({ comment_text: commentText }));
        },

        toggleEventReminder: function(eventId, callback) {
            var token = this.getCmsAuthToken();
            if (!token) return callback(new Error('Not logged in'));
            var cmsUrl = this.getCmsUrl();
            var url = cmsUrl + '/api/events/' + eventId + '/reminder';
            var xhr = new XMLHttpRequest();
            xhr.open('POST', url, true);
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.setRequestHeader('Authorization', 'Bearer ' + token);
            xhr.timeout = 15000;
            xhr.onload = function() {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try { callback(null, JSON.parse(xhr.responseText)); } catch(e) { callback(new Error('Invalid response')); }
                } else { callback(new Error('HTTP ' + xhr.status)); }
            };
            xhr.onerror = function() { callback(new Error('Network error')); };
            xhr.ontimeout = function() { callback(new Error('Timeout')); };
            xhr.send();
        },

        getEventReminderStatus: function(eventId, callback) {
            var cmsUrl = this.getCmsUrl();
            if (!cmsUrl) return callback(new Error('CMS not configured'));
            var token = this.getCmsAuthToken();
            var url = cmsUrl + '/api/events/' + eventId + '/reminder';
            var xhr = new XMLHttpRequest();
            xhr.open('GET', url, true);
            if (token) xhr.setRequestHeader('Authorization', 'Bearer ' + token);
            xhr.timeout = 15000;
            xhr.onload = function() {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try { callback(null, JSON.parse(xhr.responseText)); } catch(e) { callback(new Error('Invalid response')); }
                } else { callback(new Error('HTTP ' + xhr.status)); }
            };
            xhr.onerror = function() { callback(new Error('Network error')); };
            xhr.ontimeout = function() { callback(new Error('Timeout')); };
            xhr.send();
        },

        getUserPublicProfile: function(profileId, callback) {
            var cmsUrl = this.getCmsUrl();
            if (!cmsUrl) return callback(new Error('CMS not configured'));
            var token = this.getCmsAuthToken();
            var url = cmsUrl + '/api/profile/' + profileId;
            var xhr = new XMLHttpRequest();
            xhr.open('GET', url, true);
            if (token) xhr.setRequestHeader('Authorization', 'Bearer ' + token);
            xhr.timeout = 15000;
            xhr.onload = function() {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        var resp = JSON.parse(xhr.responseText);
                        if (resp.success) callback(null, resp.profile);
                        else callback(new Error(resp.error || 'Failed'));
                    } catch(e) { callback(new Error('Invalid response')); }
                } else { callback(new Error('HTTP ' + xhr.status)); }
            };
            xhr.onerror = function() { callback(new Error('Network error')); };
            xhr.ontimeout = function() { callback(new Error('Timeout')); };
            xhr.send();
        },

        getUserAchievements: function(profileId, callback) {
            var cmsUrl = this.getCmsUrl();
            if (!cmsUrl) return callback(new Error('CMS not configured'));
            var token = this.getCmsAuthToken();
            var url = cmsUrl + '/api/profile/' + profileId + '/achievements';
            var xhr = new XMLHttpRequest();
            xhr.open('GET', url, true);
            if (token) xhr.setRequestHeader('Authorization', 'Bearer ' + token);
            xhr.timeout = 15000;
            xhr.onload = function() {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        var resp = JSON.parse(xhr.responseText);
                        if (resp.success) callback(null, resp);
                        else callback(new Error(resp.error || 'Failed'));
                    } catch(e) { callback(new Error('Invalid response')); }
                } else { callback(new Error('HTTP ' + xhr.status)); }
            };
            xhr.onerror = function() { callback(new Error('Network error')); };
            xhr.ontimeout = function() { callback(new Error('Timeout')); };
            xhr.send();
        },

        deleteGameAchievements: function(profileId, titleId, callback) {
            var cmsUrl = this.getCmsUrl();
            if (!cmsUrl) return callback(new Error('CMS not configured'));
            var token = this.getCmsAuthToken();
            if (!token) return callback(new Error('Not logged in'));
            var url = cmsUrl + '/api/profile/' + profileId + '/achievements/game/' + encodeURIComponent(titleId);
            var xhr = new XMLHttpRequest();
            xhr.open('DELETE', url, true);
            xhr.setRequestHeader('Authorization', 'Bearer ' + token);
            xhr.timeout = 15000;
            xhr.onload = function() {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        var resp = JSON.parse(xhr.responseText);
                        if (resp.success) callback(null, resp);
                        else callback(new Error(resp.error || 'Failed'));
                    } catch(e) { callback(new Error('Invalid response')); }
                } else { callback(new Error('HTTP ' + xhr.status)); }
            };
            xhr.onerror = function() { callback(new Error('Network error')); };
            xhr.ontimeout = function() { callback(new Error('Timeout')); };
            xhr.send();
        },

        getUserPublicStats: function(profileId, callback) {
            var cmsUrl = this.getCmsUrl();
            if (!cmsUrl) return callback(new Error('CMS not configured'));
            var token = this.getCmsAuthToken();
            var url = cmsUrl + '/api/profile/' + profileId + '/stats';
            var xhr = new XMLHttpRequest();
            xhr.open('GET', url, true);
            if (token) xhr.setRequestHeader('Authorization', 'Bearer ' + token);
            xhr.timeout = 15000;
            xhr.onload = function() {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        var resp = JSON.parse(xhr.responseText);
                        if (resp.success) callback(null, resp);
                        else callback(new Error(resp.error || 'Failed'));
                    } catch(e) { callback(new Error('Invalid response')); }
                } else { callback(new Error('HTTP ' + xhr.status)); }
            };
            xhr.onerror = function() { callback(new Error('Network error')); };
            xhr.ontimeout = function() { callback(new Error('Timeout')); };
            xhr.send();
        },

        getUserFavorites: function(profileId, callback) {
            var cmsUrl = this.getCmsUrl();
            if (!cmsUrl) return callback(new Error('CMS not configured'));
            var token = this.getCmsAuthToken();
            var url = cmsUrl + '/api/profile/' + profileId + '/favorites';
            var xhr = new XMLHttpRequest();
            xhr.open('GET', url, true);
            if (token) xhr.setRequestHeader('Authorization', 'Bearer ' + token);
            xhr.timeout = 15000;
            xhr.onload = function() {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        var resp = JSON.parse(xhr.responseText);
                        callback(null, resp);
                    } catch(e) { callback(new Error('Invalid response')); }
                } else { callback(new Error('HTTP ' + xhr.status)); }
            };
            xhr.onerror = function() { callback(new Error('Network error')); };
            xhr.ontimeout = function() { callback(new Error('Timeout')); };
            xhr.send();
        },

        getUserGameStats: function(profileId, callback) {
            var cmsUrl = this.getCmsUrl();
            if (!cmsUrl) return callback(new Error('CMS not configured'));
            var token = this.getCmsAuthToken();
            var url = cmsUrl + '/api/profile/' + profileId + '/gamestats';
            var xhr = new XMLHttpRequest();
            xhr.open('GET', url, true);
            if (token) xhr.setRequestHeader('Authorization', 'Bearer ' + token);
            xhr.timeout = 15000;
            xhr.onload = function() {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        var resp = JSON.parse(xhr.responseText);
                        callback(null, resp);
                    } catch(e) { callback(new Error('Invalid response')); }
                } else { callback(new Error('HTTP ' + xhr.status)); }
            };
            xhr.onerror = function() { callback(new Error('Network error')); };
            xhr.ontimeout = function() { callback(new Error('Timeout')); };
            xhr.send();
        },

        postGameStats: function(profileId, data, callback) {
            var token = this.getCmsAuthToken();
            if (!token) return callback(new Error('Not logged in'));
            var cmsUrl = this.getCmsUrl();
            if (!cmsUrl) return callback(new Error('CMS not configured'));
            var xhr = new XMLHttpRequest();
            xhr.open('POST', cmsUrl + '/api/profile/' + profileId + '/gamestats', true);
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.setRequestHeader('Authorization', 'Bearer ' + token);
            xhr.timeout = 15000;
            xhr.onload = function() {
                try {
                    var resp = JSON.parse(xhr.responseText);
                    if (resp.success) callback(null, resp);
                    else callback(new Error(resp.error || 'Failed'));
                } catch(e) { callback(new Error('Invalid response')); }
            };
            xhr.onerror = function() { callback(new Error('Network error')); };
            xhr.ontimeout = function() { callback(new Error('Timeout')); };
            xhr.send(JSON.stringify(data));
        },

        cmsLookupGameByTitleId: function(titleId, callback) {
            var cmsUrl = this.getCmsUrl();
            if (!cmsUrl) return callback(new Error('CMS not configured'));
            var lang = (typeof I18n !== 'undefined' && I18n.getLanguage) ? I18n.getLanguage() : 'pt';
            var xhr = new XMLHttpRequest();
            xhr.open('GET', cmsUrl + '/api/game/by-title-id/' + encodeURIComponent(titleId) + '?lang=' + encodeURIComponent(lang), true);
            xhr.timeout = 10000;
            xhr.onload = function() {
                try {
                    var resp = JSON.parse(xhr.responseText);
                    callback(null, resp);
                } catch(e) { callback(new Error('Invalid response')); }
            };
            xhr.onerror = function() { callback(new Error('Network error')); };
            xhr.ontimeout = function() { callback(new Error('Timeout')); };
            xhr.send();
        },

        cmsGetAchievementCounts: function(titleIds, callback) {
            var cmsUrl = this.getCmsUrl();
            if (!cmsUrl) return callback(new Error('CMS not configured'));
            var xhr = new XMLHttpRequest();
            xhr.open('GET', cmsUrl + '/api/game-achievements/counts?title_ids=' + encodeURIComponent(titleIds.join(',')), true);
            xhr.timeout = 10000;
            xhr.onload = function() {
                try {
                    var resp = JSON.parse(xhr.responseText);
                    callback(null, resp);
                } catch(e) { callback(new Error('Invalid response')); }
            };
            xhr.onerror = function() { callback(new Error('Network error')); };
            xhr.ontimeout = function() { callback(new Error('Timeout')); };
            xhr.send();
        },

        harvestAchievements: function(profileId, achievements, callback) {
            var token = this.getCmsAuthToken();
            if (!token) return callback(new Error('Not logged in'));
            var cmsUrl = this.getCmsUrl();
            var xhr = new XMLHttpRequest();
            xhr.open('POST', cmsUrl + '/api/profile/' + profileId + '/achievements/harvest', true);
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.setRequestHeader('Authorization', 'Bearer ' + token);
            xhr.timeout = 30000;
            xhr.onload = function() {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        var resp = JSON.parse(xhr.responseText);
                        if (resp.success) callback(null, resp);
                        else callback(new Error(resp.error || 'Failed'));
                    } catch(e) { callback(new Error('Invalid response')); }
                } else {
                    try {
                        var errResp = JSON.parse(xhr.responseText);
                        callback(new Error(errResp.error || 'HTTP ' + xhr.status));
                    } catch(e) { callback(new Error('HTTP ' + xhr.status)); }
                }
            };
            xhr.onerror = function() { callback(new Error('Network error')); };
            xhr.ontimeout = function() { callback(new Error('Timeout')); };
            xhr.send(JSON.stringify({ achievements: achievements }));
        },

        autoRegisterGame: function(data, callback) {
            var token = this.getCmsAuthToken();
            if (!token) return callback(new Error('Not logged in'));
            var cmsUrl = this.getCmsUrl();
            var xhr = new XMLHttpRequest();
            xhr.open('POST', cmsUrl + '/api/game/auto-register', true);
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.setRequestHeader('Authorization', 'Bearer ' + token);
            xhr.timeout = 30000;
            xhr.onload = function() {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        var resp = JSON.parse(xhr.responseText);
                        if (resp.success) callback(null, resp);
                        else callback(new Error(resp.error || 'Failed'));
                    } catch(e) { callback(new Error('Invalid response')); }
                } else {
                    callback(new Error('HTTP ' + xhr.status));
                }
            };
            xhr.onerror = function() { callback(new Error('Network error')); };
            xhr.ontimeout = function() { callback(new Error('Timeout')); };
            xhr.send(JSON.stringify(data));
        },

        uploadGameCover: function(data, callback) {
            var token = this.getCmsAuthToken();
            if (!token) return callback(new Error('Not logged in'));
            var cmsUrl = this.getCmsUrl();
            var xhr = new XMLHttpRequest();
            xhr.open('POST', cmsUrl + '/api/game/upload-cover', true);
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.setRequestHeader('Authorization', 'Bearer ' + token);
            xhr.timeout = 30000;
            xhr.onload = function() {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        var resp = JSON.parse(xhr.responseText);
                        if (resp.success) callback(null, resp);
                        else callback(new Error(resp.error || 'Failed'));
                    } catch(e) { callback(new Error('Invalid response')); }
                } else {
                    callback(new Error('HTTP ' + xhr.status));
                }
            };
            xhr.onerror = function() { callback(new Error('Network error')); };
            xhr.ontimeout = function() { callback(new Error('Timeout')); };
            xhr.send(JSON.stringify(data));
        },

        uploadAchievementImages: function(images, callback) {
            var token = this.getCmsAuthToken();
            if (!token) return callback(new Error('Not logged in'));
            var cmsUrl = this.getCmsUrl();
            var xhr = new XMLHttpRequest();
            xhr.open('POST', cmsUrl + '/api/achievements/upload-images', true);
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.setRequestHeader('Authorization', 'Bearer ' + token);
            xhr.timeout = 60000;
            xhr.onload = function() {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        var resp = JSON.parse(xhr.responseText);
                        if (resp.success) callback(null, resp);
                        else callback(new Error(resp.error || 'Failed'));
                    } catch(e) { callback(new Error('Invalid response')); }
                } else {
                    callback(new Error('HTTP ' + xhr.status));
                }
            };
            xhr.onerror = function() { callback(new Error('Network error')); };
            xhr.ontimeout = function() { callback(new Error('Timeout')); };
            xhr.send(JSON.stringify({ images: images }));
        },

        fetchImageAsBase64: function(url, callback) {
            if (!url) return callback(null, null);
            var isExternal = false;
            try {
                var parsed = new URL(url, window.location.origin);
                isExternal = parsed.origin !== window.location.origin;
            } catch(e) {}
            var fetchUrl = url;
            if (isExternal) {
                var cmsUrl = this.getCmsUrl ? this.getCmsUrl() : '';
                if (!cmsUrl || !authToken) return callback(null, null);
                fetchUrl = cmsUrl + '/api/image-proxy?url=' + encodeURIComponent(url);
            }
            var xhr = new XMLHttpRequest();
            xhr.open('GET', fetchUrl, true);
            xhr.responseType = 'blob';
            if (authToken) {
                xhr.setRequestHeader('Authorization', 'Bearer ' + authToken);
            }
            xhr.timeout = 15000;
            xhr.onload = function() {
                if (xhr.status === 200 && xhr.response) {
                    var reader = new FileReader();
                    reader.onloadend = function() {
                        callback(null, reader.result);
                    };
                    reader.onerror = function() { callback(null, null); };
                    reader.readAsDataURL(xhr.response);
                } else {
                    callback(null, null);
                }
            };
            xhr.onerror = function() { callback(null, null); };
            xhr.ontimeout = function() { callback(null, null); };
            xhr.send();
        },

        getFtpBridgeUrl: function() {
            try { return localStorage.getItem('nova_ftp_bridge_url') || ''; } catch(e) { return ''; }
        },
        setFtpBridgeUrl: function(url) {
            try {
                if (url) localStorage.setItem('nova_ftp_bridge_url', url.replace(/\/+$/, ''));
                else localStorage.removeItem('nova_ftp_bridge_url');
            } catch(e) {}
        },
        checkFtpBridge: function(url, callback) {
            var xhr = new XMLHttpRequest();
            xhr.open('GET', url.replace(/\/+$/, '') + '/status', true);
            xhr.timeout = 3000;
            xhr.onload = function() {
                try {
                    var data = JSON.parse(xhr.responseText);
                    if (data && data.type === 'godsend-ftp-bridge') {
                        callback(null, data);
                    } else {
                        callback(new Error('Not a GodStix FTP Bridge'));
                    }
                } catch(e) { callback(new Error('Invalid response')); }
            };
            xhr.onerror = function() { callback(new Error('Connection failed')); };
            xhr.ontimeout = function() { callback(new Error('Timeout')); };
            xhr.send();
        },
        autoDiscoverFtpBridge: function(callback) {
            var self = this;
            var saved = self.getFtpBridgeUrl();
            if (saved) {
                self.checkFtpBridge(saved, function(err, data) {
                    if (!err) return callback(null, saved, data);
                    tryCommon();
                });
                return;
            }
            tryCommon();
            function tryCommon() {
                var candidates = [
                    'http://localhost:7860',
                    'http://127.0.0.1:7860'
                ];
                try {
                    var h = window.location.hostname;
                    if (h && h !== 'localhost' && h !== '127.0.0.1') {
                        candidates.push('http://' + h + ':7860');
                    }
                } catch(e) {}
                var idx = 0;
                function tryNext() {
                    if (idx >= candidates.length) return callback(new Error('Bridge not found'));
                    var url = candidates[idx++];
                    self.checkFtpBridge(url, function(err, data) {
                        if (!err) {
                            self.setFtpBridgeUrl(url);
                            callback(null, url, data);
                        } else {
                            tryNext();
                        }
                    });
                }
                tryNext();
            }
        },
        ftpList: function(path, callback) {
            var url = this.getFtpBridgeUrl();
            if (!url) return callback(new Error('Bridge not configured'));
            var xhr = new XMLHttpRequest();
            xhr.open('GET', url + '/list?path=' + encodeURIComponent(path), true);
            xhr.timeout = 15000;
            xhr.onload = function() {
                try {
                    var data = JSON.parse(xhr.responseText);
                    if (data.error) return callback(new Error(data.error));
                    callback(null, data);
                } catch(e) { callback(new Error('Parse error')); }
            };
            xhr.onerror = function() { callback(new Error('Connection failed')); };
            xhr.ontimeout = function() { callback(new Error('Timeout')); };
            xhr.send();
        },
        ftpDownload: function(filePath, filename) {
            var url = this.getFtpBridgeUrl();
            if (!url) return;
            var dlUrl = url + '/download?path=' + encodeURIComponent(filePath);
            var a = document.createElement('a');
            a.href = dlUrl;
            a.download = filename || 'file';
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            setTimeout(function() { document.body.removeChild(a); }, 1000);
        },
        ftpDownloadWithProgress: function(filePath, filename, onProgress, callback) {
            var url = this.getFtpBridgeUrl();
            if (!url) return callback(new Error('Bridge not configured'));
            var xhr = new XMLHttpRequest();
            xhr.open('GET', url + '/download?path=' + encodeURIComponent(filePath), true);
            xhr.responseType = 'blob';
            xhr.onprogress = function(e) {
                if (onProgress && e.lengthComputable) {
                    onProgress({ loaded: e.loaded, total: e.total, percentage: Math.round((e.loaded / e.total) * 100) });
                }
            };
            xhr.onload = function() {
                if (xhr.status === 200) {
                    var blob = xhr.response;
                    var blobUrl = URL.createObjectURL(blob);
                    var a = document.createElement('a');
                    a.href = blobUrl;
                    a.download = filename || 'file';
                    document.body.appendChild(a);
                    a.click();
                    setTimeout(function() { document.body.removeChild(a); URL.revokeObjectURL(blobUrl); }, 1000);
                    callback(null);
                } else {
                    callback(new Error('Download failed'));
                }
            };
            xhr.onerror = function() { callback(new Error('Connection failed')); };
            xhr.send();
        },
        ftpUpload: function(destPath, files, onProgress, callback) {
            var url = this.getFtpBridgeUrl();
            if (!url) return callback(new Error('Bridge not configured'));
            var formData = new FormData();
            for (var i = 0; i < files.length; i++) {
                formData.append('files', files[i]);
            }
            var xhr = new XMLHttpRequest();
            xhr.open('POST', url + '/upload?path=' + encodeURIComponent(destPath), true);
            xhr.upload.onprogress = function(e) {
                if (onProgress && e.lengthComputable) {
                    onProgress({ loaded: e.loaded, total: e.total, percentage: Math.round((e.loaded / e.total) * 100), phase: 'uploading' });
                }
            };
            xhr.onload = function() {
                try {
                    var data = JSON.parse(xhr.responseText);
                    if (data.error) return callback(new Error(data.error));
                    callback(null, data);
                } catch(e) { callback(new Error('Parse error')); }
            };
            xhr.onerror = function() { callback(new Error('Connection failed')); };
            xhr.send(formData);
        },
        ftpDelete: function(filePath, isDir, callback) {
            var url = this.getFtpBridgeUrl();
            if (!url) return callback(new Error('Bridge not configured'));
            var xhr = new XMLHttpRequest();
            var qp = '?path=' + encodeURIComponent(filePath);
            if (isDir) qp += '&type=directory';
            xhr.open('DELETE', url + '/delete' + qp, true);
            xhr.timeout = 30000;
            xhr.onload = function() {
                try {
                    var data = JSON.parse(xhr.responseText);
                    if (data.error) return callback(new Error(data.error));
                    callback(null, data);
                } catch(e) { callback(new Error('Parse error')); }
            };
            xhr.onerror = function() { callback(new Error('Connection failed')); };
            xhr.ontimeout = function() { callback(new Error('Timeout')); };
            xhr.send();
        },
        ftpMove: function(from, to, callback) {
            var url = this.getFtpBridgeUrl();
            if (!url) return callback(new Error('Bridge not configured'));
            var xhr = new XMLHttpRequest();
            xhr.open('POST', url + '/move', true);
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.timeout = 15000;
            xhr.onload = function() {
                try {
                    var data = JSON.parse(xhr.responseText);
                    if (data.error) return callback(new Error(data.error));
                    callback(null, data);
                } catch(e) { callback(new Error('Parse error')); }
            };
            xhr.onerror = function() { callback(new Error('Connection failed')); };
            xhr.ontimeout = function() { callback(new Error('Timeout')); };
            xhr.send(JSON.stringify({ from: from, to: to }));
        },
        ftpMkdir: function(dirPath, callback) {
            var url = this.getFtpBridgeUrl();
            if (!url) return callback(new Error('Bridge not configured'));
            var xhr = new XMLHttpRequest();
            xhr.open('POST', url + '/mkdir?path=' + encodeURIComponent(dirPath), true);
            xhr.timeout = 15000;
            xhr.onload = function() {
                try {
                    var data = JSON.parse(xhr.responseText);
                    if (data.error) return callback(new Error(data.error));
                    callback(null, data);
                } catch(e) { callback(new Error('Parse error')); }
            };
            xhr.onerror = function() { callback(new Error('Connection failed')); };
            xhr.ontimeout = function() { callback(new Error('Timeout')); };
            xhr.send();
        },
        ftpTransferProgress: function(transferId, callback) {
            var url = this.getFtpBridgeUrl();
            if (!url) return callback(new Error('Bridge not configured'));
            var xhr = new XMLHttpRequest();
            xhr.open('GET', url + '/transfer-progress/' + transferId, true);
            xhr.timeout = 5000;
            xhr.onload = function() {
                try {
                    var data = JSON.parse(xhr.responseText);
                    if (data.error) return callback(new Error(data.error));
                    callback(null, data);
                } catch(e) { callback(new Error('Parse error')); }
            };
            xhr.onerror = function() { callback(new Error('Connection failed')); };
            xhr.ontimeout = function() { callback(new Error('Timeout')); };
            xhr.send();
        },
        ftpUpdateConfig: function(configData, callback) {
            var url = this.getFtpBridgeUrl();
            if (!url) return callback(new Error('Bridge not configured'));
            var xhr = new XMLHttpRequest();
            xhr.open('POST', url + '/config', true);
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.timeout = 10000;
            xhr.onload = function() {
                try {
                    var data = JSON.parse(xhr.responseText);
                    if (data.error) return callback(new Error(data.error));
                    callback(null, data);
                } catch(e) { callback(new Error('Parse error')); }
            };
            xhr.onerror = function() { callback(new Error('Connection failed')); };
            xhr.send(JSON.stringify(configData));
        },

        getXbdmBridgeUrl: function() {
            try { return localStorage.getItem('nova_xbdm_bridge_url') || ''; } catch(e) { return ''; }
        },
        setXbdmBridgeUrl: function(url) {
            try {
                if (url) localStorage.setItem('nova_xbdm_bridge_url', url.replace(/\/+$/, ''));
                else localStorage.removeItem('nova_xbdm_bridge_url');
            } catch(e) {}
        },
        checkXbdmBridge: function(url, callback) {
            var xhr = new XMLHttpRequest();
            xhr.open('GET', url.replace(/\/+$/, '') + '/status', true);
            xhr.timeout = 20000;
            xhr.onload = function() {
                try {
                    var data = JSON.parse(xhr.responseText);
                    if (data && data.type === 'godsend-xbdm-bridge') {
                        callback(null, data);
                    } else {
                        callback(new Error('Not a GodStix XBDM Bridge'));
                    }
                } catch(e) { callback(new Error('Invalid response')); }
            };
            xhr.onerror = function() { callback(new Error('Connection failed')); };
            xhr.ontimeout = function() { callback(new Error('Timeout')); };
            xhr.send();
        },
        autoDiscoverXbdmBridge: function(callback) {
            var self = this;
            var saved = self.getXbdmBridgeUrl();
            if (saved) {
                self.checkXbdmBridge(saved, function(err, data) {
                    if (!err) return callback(null, saved, data);
                    tryCommon();
                });
                return;
            }
            tryCommon();
            function tryCommon() {
                var candidates = [
                    'http://localhost:7861',
                    'http://127.0.0.1:7861'
                ];
                try {
                    var h = window.location.hostname;
                    if (h && h !== 'localhost' && h !== '127.0.0.1') {
                        candidates.push('http://' + h + ':7861');
                    }
                } catch(e) {}
                var idx = 0;
                function tryNext() {
                    if (idx >= candidates.length) return callback(new Error('XBDM Bridge not found'));
                    var url = candidates[idx++];
                    self.checkXbdmBridge(url, function(err, data) {
                        if (!err) {
                            self.setXbdmBridgeUrl(url);
                            callback(null, url, data);
                        } else {
                            tryNext();
                        }
                    });
                }
                tryNext();
            }
        },
        xbdmCommand: function(command, callback) {
            var url = this.getXbdmBridgeUrl();
            if (!url) return callback(new Error('XBDM Bridge not configured'));
            var xhr = new XMLHttpRequest();
            xhr.open('POST', url + '/command', true);
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.timeout = 15000;
            xhr.onload = function() {
                try {
                    var data = JSON.parse(xhr.responseText);
                    if (data.error) return callback(new Error(data.error));
                    callback(null, data);
                } catch(e) { callback(new Error('Parse error')); }
            };
            xhr.onerror = function() { callback(new Error('Connection failed')); };
            xhr.ontimeout = function() { callback(new Error('Timeout')); };
            xhr.send(JSON.stringify({ command: command }));
        },
        xbdmList: function(path, callback) {
            var url = this.getXbdmBridgeUrl();
            if (!url) return callback(new Error('XBDM Bridge not configured'));
            var xhr = new XMLHttpRequest();
            xhr.open('GET', url + '/list?path=' + encodeURIComponent(path), true);
            xhr.timeout = 15000;
            xhr.onload = function() {
                try {
                    var data = JSON.parse(xhr.responseText);
                    if (data.error) return callback(new Error(data.error));
                    callback(null, data);
                } catch(e) { callback(new Error('Parse error')); }
            };
            xhr.onerror = function() { callback(new Error('Connection failed')); };
            xhr.ontimeout = function() { callback(new Error('Timeout')); };
            xhr.send();
        },
        xbdmDownload: function(filePath, filename) {
            var url = this.getXbdmBridgeUrl();
            if (!url) return;
            var dlUrl = url + '/download?path=' + encodeURIComponent(filePath);
            var a = document.createElement('a');
            a.href = dlUrl;
            a.download = filename || 'file';
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            setTimeout(function() { document.body.removeChild(a); }, 1000);
        },
        xbdmUpload: function(destPath, files, onProgress, callback) {
            var url = this.getXbdmBridgeUrl();
            if (!url) return callback(new Error('XBDM Bridge not configured'));
            var formData = new FormData();
            for (var i = 0; i < files.length; i++) {
                formData.append('files', files[i]);
            }
            var xhr = new XMLHttpRequest();
            xhr.open('POST', url + '/upload?path=' + encodeURIComponent(destPath), true);
            xhr.upload.onprogress = function(e) {
                if (onProgress && e.lengthComputable) {
                    onProgress({ loaded: e.loaded, total: e.total, percentage: Math.round((e.loaded / e.total) * 100), phase: 'uploading' });
                }
            };
            xhr.onload = function() {
                try {
                    var data = JSON.parse(xhr.responseText);
                    if (data.error) return callback(new Error(data.error));
                    callback(null, data);
                } catch(e) { callback(new Error('Parse error')); }
            };
            xhr.onerror = function() { callback(new Error('Connection failed')); };
            xhr.send(formData);
        },
        xbdmDelete: function(filePath, isDir, callback) {
            var url = this.getXbdmBridgeUrl();
            if (!url) return callback(new Error('XBDM Bridge not configured'));
            var xhr = new XMLHttpRequest();
            var qp = '?path=' + encodeURIComponent(filePath);
            if (isDir) qp += '&type=directory';
            xhr.open('DELETE', url + '/delete' + qp, true);
            xhr.timeout = 30000;
            xhr.onload = function() {
                try {
                    var data = JSON.parse(xhr.responseText);
                    if (data.error) return callback(new Error(data.error));
                    callback(null, data);
                } catch(e) { callback(new Error('Parse error')); }
            };
            xhr.onerror = function() { callback(new Error('Connection failed')); };
            xhr.ontimeout = function() { callback(new Error('Timeout')); };
            xhr.send();
        },
        xbdmMove: function(from, to, callback) {
            var url = this.getXbdmBridgeUrl();
            if (!url) return callback(new Error('XBDM Bridge not configured'));
            var xhr = new XMLHttpRequest();
            xhr.open('POST', url + '/move', true);
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.timeout = 15000;
            xhr.onload = function() {
                try {
                    var data = JSON.parse(xhr.responseText);
                    if (data.error) return callback(new Error(data.error));
                    callback(null, data);
                } catch(e) { callback(new Error('Parse error')); }
            };
            xhr.onerror = function() { callback(new Error('Connection failed')); };
            xhr.ontimeout = function() { callback(new Error('Timeout')); };
            xhr.send(JSON.stringify({ from: from, to: to }));
        },
        xbdmMkdir: function(dirPath, callback) {
            var url = this.getXbdmBridgeUrl();
            if (!url) return callback(new Error('XBDM Bridge not configured'));
            var xhr = new XMLHttpRequest();
            xhr.open('POST', url + '/mkdir?path=' + encodeURIComponent(dirPath), true);
            xhr.timeout = 15000;
            xhr.onload = function() {
                try {
                    var data = JSON.parse(xhr.responseText);
                    if (data.error) return callback(new Error(data.error));
                    callback(null, data);
                } catch(e) { callback(new Error('Parse error')); }
            };
            xhr.onerror = function() { callback(new Error('Connection failed')); };
            xhr.ontimeout = function() { callback(new Error('Timeout')); };
            xhr.send();
        },
        xbdmTransferProgress: function(transferId, callback) {
            var url = this.getXbdmBridgeUrl();
            if (!url) return callback(new Error('XBDM Bridge not configured'));
            var xhr = new XMLHttpRequest();
            xhr.open('GET', url + '/transfer-progress/' + transferId, true);
            xhr.timeout = 5000;
            xhr.onload = function() {
                try {
                    var data = JSON.parse(xhr.responseText);
                    if (data.error) return callback(new Error(data.error));
                    callback(null, data);
                } catch(e) { callback(new Error('Parse error')); }
            };
            xhr.onerror = function() { callback(new Error('Connection failed')); };
            xhr.ontimeout = function() { callback(new Error('Timeout')); };
            xhr.send();
        },
        xbdmUpdateConfig: function(configData, callback) {
            var url = this.getXbdmBridgeUrl();
            if (!url) return callback(new Error('XBDM Bridge not configured'));
            var xhr = new XMLHttpRequest();
            xhr.open('POST', url + '/config', true);
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.timeout = 10000;
            xhr.onload = function() {
                try {
                    var data = JSON.parse(xhr.responseText);
                    if (data.error) return callback(new Error(data.error));
                    callback(null, data);
                } catch(e) { callback(new Error('Parse error')); }
            };
            xhr.onerror = function() { callback(new Error('Connection failed')); };
            xhr.send(JSON.stringify(configData));
        },

        ftpReadFile: function(filePath, callback) {
            var url = this.getFtpBridgeUrl();
            if (!url) return callback(new Error('Bridge not configured'));
            var xhr = new XMLHttpRequest();
            xhr.open('GET', url + '/readfile?path=' + encodeURIComponent(filePath), true);
            xhr.timeout = 30000;
            xhr.onload = function() {
                try {
                    var data = JSON.parse(xhr.responseText);
                    if (data.error) return callback(new Error(data.error));
                    callback(null, data);
                } catch(e) { callback(new Error('Parse error')); }
            };
            xhr.onerror = function() { callback(new Error('Connection failed')); };
            xhr.ontimeout = function() { callback(new Error('Timeout')); };
            xhr.send();
        },
        ftpWriteFile: function(filePath, content, callback) {
            var url = this.getFtpBridgeUrl();
            if (!url) return callback(new Error('Bridge not configured'));
            var xhr = new XMLHttpRequest();
            xhr.open('POST', url + '/writefile?path=' + encodeURIComponent(filePath), true);
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.timeout = 30000;
            xhr.onload = function() {
                try {
                    var data = JSON.parse(xhr.responseText);
                    if (data.error) return callback(new Error(data.error));
                    callback(null, data);
                } catch(e) { callback(new Error('Parse error')); }
            };
            xhr.onerror = function() { callback(new Error('Connection failed')); };
            xhr.ontimeout = function() { callback(new Error('Timeout')); };
            xhr.send(JSON.stringify({ content: content }));
        },
        xbdmReadFile: function(filePath, callback) {
            var url = this.getXbdmBridgeUrl();
            if (!url) return callback(new Error('XBDM Bridge not configured'));
            var xhr = new XMLHttpRequest();
            xhr.open('GET', url + '/readfile?path=' + encodeURIComponent(filePath), true);
            xhr.timeout = 60000;
            xhr.onload = function() {
                try {
                    var data = JSON.parse(xhr.responseText);
                    if (data.error) return callback(new Error(data.error));
                    callback(null, data);
                } catch(e) { callback(new Error('Parse error')); }
            };
            xhr.onerror = function() { callback(new Error('Connection failed')); };
            xhr.ontimeout = function() { callback(new Error('Timeout')); };
            xhr.send();
        },
        xbdmWriteFile: function(filePath, content, callback) {
            var url = this.getXbdmBridgeUrl();
            if (!url) return callback(new Error('XBDM Bridge not configured'));
            var xhr = new XMLHttpRequest();
            xhr.open('POST', url + '/writefile?path=' + encodeURIComponent(filePath), true);
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.timeout = 30000;
            xhr.onload = function() {
                try {
                    var data = JSON.parse(xhr.responseText);
                    if (data.error) return callback(new Error(data.error));
                    callback(null, data);
                } catch(e) { callback(new Error('Parse error')); }
            };
            xhr.onerror = function() { callback(new Error('Connection failed')); };
            xhr.ontimeout = function() { callback(new Error('Timeout')); };
            xhr.send(JSON.stringify({ content: content }));
        },

        submitFeedback: function(payload, callback) {
            var cmsUrl = this.getCmsUrl();
            if (!cmsUrl) return callback(new Error('CMS not configured'));
            var token = this.getCmsAuthToken();
            if (!token) return callback(new Error('Not authenticated'));
            var xhr = new XMLHttpRequest();
            xhr.open('POST', cmsUrl + '/api/feedback', true);
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.setRequestHeader('Authorization', 'Bearer ' + token);
            xhr.timeout = 15000;
            xhr.onload = function() {
                try {
                    var resp = JSON.parse(xhr.responseText);
                    if (!resp.success) return callback(new Error(resp.error || 'Unknown error'));
                    callback(null, resp);
                } catch(e) { callback(new Error('Invalid response')); }
            };
            xhr.onerror = function() { callback(new Error('Network error')); };
            xhr.ontimeout = function() { callback(new Error('Timeout')); };
            xhr.send(JSON.stringify(payload));
        },

        _urlBase64ToUint8Array: function(base64String) {
            var padding = '='.repeat((4 - base64String.length % 4) % 4);
            var base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
            var rawData = window.atob(base64);
            var outputArray = new Uint8Array(rawData.length);
            for (var i = 0; i < rawData.length; ++i) {
                outputArray[i] = rawData.charCodeAt(i);
            }
            return outputArray;
        }
    };
})();
