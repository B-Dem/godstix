var GodStixPWA = (function() {
    var deferredPrompt = null;
    var STORAGE_KEY = 'godstix_xbox_ip';
    var DISMISSED_KEY = 'godstix_pwa_dismissed';
    var PORT = 9999;
    var initialized = false;
    var reconnectBound = false;
    var bannerBound = false;

    function getSavedIp() {
        try { return localStorage.getItem(STORAGE_KEY) || ''; } catch(e) { return ''; }
    }

    function saveIp(ip) {
        try { localStorage.setItem(STORAGE_KEY, ip); } catch(e) {}
    }

    function getCurrentHostIp() {
        try {
            var host = window.location.hostname;
            if (host && host !== 'localhost' && host !== '127.0.0.1' && host.indexOf('.') !== -1) {
                return host;
            }
        } catch(e) {}
        return '';
    }

    function isDismissed() {
        try { return localStorage.getItem(DISMISSED_KEY) === '1'; } catch(e) { return false; }
    }

    function setDismissed() {
        try { localStorage.setItem(DISMISSED_KEY, '1'); } catch(e) {}
    }

    function isStandalone() {
        return window.matchMedia('(display-mode: standalone)').matches ||
               window.navigator.standalone === true;
    }

    function testConnection(ip, callback) {
        var url = 'http://' + ip + ':' + PORT + '/system';
        var xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.timeout = 5000;
        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
                callback(xhr.status >= 200 && xhr.status < 400);
            }
        };
        xhr.onerror = function() { callback(false); };
        xhr.ontimeout = function() { callback(false); };
        try { xhr.send(); } catch(e) { callback(false); }
    }

    function updateI18nTexts() {
        var lang = 'pt';
        try { lang = I18n.getLanguage ? I18n.getLanguage() : 'pt'; } catch(e) {}

        var texts = {
            pt: {
                install_title: 'Instalar GodStix',
                install_desc: 'Acesse direto da tela inicial',
                install_btn: 'Instalar',
                connecting: 'Conectando ao console...',
                hint: 'Certifique-se que seu console esta ligado e conectado a rede.',
                retry: 'Tentar Novamente',
                or: 'ou',
                update_label: 'Xbox ligado? Atualize o IP para se conectar:',
                connect: 'Conectar',
                ip_hint: 'Digite o IP do seu Xbox 360 (ex: 192.168.1.100)',
                connecting_to: 'Conectando a %s...',
                failed: 'Nao foi possivel conectar'
            },
            en: {
                install_title: 'Install GodStix',
                install_desc: 'Access from your home screen',
                install_btn: 'Install',
                connecting: 'Connecting to console...',
                hint: 'Make sure your console is powered on and connected to the network.',
                retry: 'Try Again',
                or: 'or',
                update_label: 'Xbox is on? Update the IP to connect:',
                connect: 'Connect',
                ip_hint: 'Enter your Xbox 360 IP (e.g. 192.168.1.100)',
                connecting_to: 'Connecting to %s...',
                failed: 'Could not connect'
            },
            es: {
                install_title: 'Instalar GodStix',
                install_desc: 'Accede desde tu pantalla de inicio',
                install_btn: 'Instalar',
                connecting: 'Conectando a la consola...',
                hint: 'Asegurate de que tu consola este encendida y conectada a la red.',
                retry: 'Reintentar',
                or: 'o',
                update_label: 'Xbox encendido? Actualiza la IP para conectar:',
                connect: 'Conectar',
                ip_hint: 'Ingresa la IP de tu Xbox 360 (ej: 192.168.1.100)',
                connecting_to: 'Conectando a %s...',
                failed: 'No se pudo conectar'
            }
        };

        var t = texts[lang] || texts.pt;

        var el;
        el = document.getElementById('pwa-install-desc');
        if (el) el.textContent = t.install_desc;
        el = document.getElementById('pwa-install-btn');
        if (el) el.textContent = t.install_btn;
        el = document.getElementById('pwa-reconnect-msg');
        if (el) el.textContent = t.connecting;
        el = document.getElementById('pwa-hint-text');
        if (el) el.textContent = t.hint;
        el = document.getElementById('pwa-retry-text');
        if (el) el.textContent = t.retry;
        el = document.getElementById('pwa-or-text');
        if (el) el.textContent = t.or;
        el = document.getElementById('pwa-update-label');
        if (el) el.textContent = t.update_label;
        el = document.getElementById('pwa-connect-text');
        if (el) el.textContent = t.connect;
        el = document.getElementById('pwa-ip-hint');
        if (el) el.textContent = t.ip_hint;

        return t;
    }

    function showInstallBanner() {
        if (isDismissed() || isStandalone()) return;

        var banner = document.getElementById('pwa-install-banner');
        if (!banner) return;

        updateI18nTexts();
        banner.classList.remove('hidden');

        if (!bannerBound) {
            bannerBound = true;
            var installBtn = document.getElementById('pwa-install-btn');
            var closeBtn = document.getElementById('pwa-install-close');

            installBtn.addEventListener('click', function() {
                if (deferredPrompt) {
                    deferredPrompt.prompt();
                    deferredPrompt.userChoice.then(function(choice) {
                        if (choice.outcome === 'accepted') {
                            saveIp(getCurrentHostIp());
                        }
                        deferredPrompt = null;
                        banner.classList.add('hidden');
                    });
                } else {
                    var lang = 'pt';
                    try { lang = I18n.getLanguage ? I18n.getLanguage() : 'pt'; } catch(e) {}
                    var msgs = {
                        pt: 'No menu do navegador, toque em "Adicionar a tela inicial" para instalar o app.',
                        en: 'In your browser menu, tap "Add to Home Screen" to install the app.',
                        es: 'En el menu del navegador, toca "Agregar a pantalla de inicio" para instalar la app.'
                    };
                    alert(msgs[lang] || msgs.pt);
                    banner.classList.add('hidden');
                    setDismissed();
                }
            });

            closeBtn.addEventListener('click', function() {
                banner.classList.add('hidden');
                setDismissed();
            });
        }
    }

    function showReconnectScreen() {
        var screen = document.getElementById('pwa-reconnect-screen');
        if (!screen) return;

        var t = updateI18nTexts();
        screen.classList.remove('hidden');

        var status = document.getElementById('pwa-reconnect-status');
        var options = document.getElementById('pwa-reconnect-options');
        var msg = document.getElementById('pwa-reconnect-msg');
        var ipInput = document.getElementById('pwa-ip-input');
        var retryBtn = document.getElementById('pwa-retry-btn');
        var connectBtn = document.getElementById('pwa-connect-btn');

        var savedIp = getSavedIp();
        if (ipInput && savedIp) ipInput.value = savedIp;

        function showOptions() {
            status.querySelector('.pwa-reconnect-spinner').style.display = 'none';
            msg.textContent = t.failed;
            options.classList.remove('hidden');
        }

        function tryConnect(ip) {
            options.classList.add('hidden');
            status.querySelector('.pwa-reconnect-spinner').style.display = '';
            msg.textContent = t.connecting_to.replace('%s', ip);

            testConnection(ip, function(ok) {
                if (ok) {
                    saveIp(ip);
                    window.location.href = 'http://' + ip + ':' + PORT + '/';
                } else {
                    showOptions();
                }
            });
        }

        if (savedIp) {
            tryConnect(savedIp);
        } else {
            status.querySelector('.pwa-reconnect-spinner').style.display = 'none';
            msg.textContent = t.failed;
            options.classList.remove('hidden');
        }

        if (!reconnectBound) {
            reconnectBound = true;

            retryBtn.addEventListener('click', function() {
                var ip = ipInput.value.trim() || getSavedIp() || getCurrentHostIp();
                if (ip) {
                    tryConnect(ip);
                } else {
                    showOptions();
                }
            });

            connectBtn.addEventListener('click', function() {
                var ip = ipInput.value.trim();
                if (!ip) {
                    ipInput.focus();
                    ipInput.style.borderColor = 'var(--danger)';
                    setTimeout(function() { ipInput.style.borderColor = ''; }, 2000);
                    return;
                }
                tryConnect(ip);
            });

            ipInput.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    connectBtn.click();
                }
            });
        }
    }

    function init() {
        if (initialized) return;
        initialized = true;

        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('sw.js').catch(function() {});
        }

        window.addEventListener('beforeinstallprompt', function(e) {
            e.preventDefault();
            deferredPrompt = e;
            showInstallBanner();
        });

        window.addEventListener('appinstalled', function() {
            saveIp(getCurrentHostIp());
            var banner = document.getElementById('pwa-install-banner');
            if (banner) banner.classList.add('hidden');
        });

        var hostIp = getCurrentHostIp();
        if (hostIp) {
            saveIp(hostIp);
        }

        if (isStandalone()) {
            var savedIp = getSavedIp();
            var currentIp = getCurrentHostIp();

            if (savedIp && currentIp && savedIp === currentIp) {
                return;
            }

            if (savedIp && (!currentIp || savedIp !== currentIp)) {
                testConnection(savedIp, function(ok) {
                    if (!ok) {
                        showReconnectScreen();
                    }
                });
                return;
            }

            if (!savedIp && !currentIp) {
                showReconnectScreen();
            }
        }
    }

    return {
        init: init,
        showReconnectScreen: showReconnectScreen,
        getSavedIp: getSavedIp,
        saveIp: saveIp,
        isStandalone: isStandalone
    };
})();
