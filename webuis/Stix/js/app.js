var App = (function() {
    var state = {
        currentPage: 'home',
        games: [],
        filteredGames: [],
        gameView: 'grid',
        gameFilter: 'all',
        searchQuery: '',
        gamePage: 1,
        gamesPerPage: 20,
        screenshots: [],
        selectedGame: null,
        systemInfo: null,
        temperature: null,
        memory: null,
        profile: null,
        filesPath: '',
        filesList: [],
        filesLoading: false,
        filesError: null,
        filesUploading: false,
        ftpBridgeConnected: false,
        ftpBridgeUrl: '',
        ftpBridgeInfo: null,
        ftpBridgeMode: false,
        ftpWizardStep: 0,
        xbdmBridgeConnected: false,
        xbdmBridgeUrl: '',
        xbdmBridgeInfo: null,
        xbdmBridgeMode: false,
        xbdmWizardStep: 0,
        xbdmTrayOpen: false,
        smc: null,
        title: null,
        titleStartTime: null,
        playtimeCheckpoint: null,
        playtimeFirstSent: false,
        lastTitleId: null,
        notification: null,
        cmsProfile: null,
        cmsNotifications: null,
        cmsStats: null,
        cmsRecentAchievements: null,
        cmsFriendsList: null,
        isOnline: navigator.onLine !== false
    };

    var pages = ['home', 'news', 'events', 'games', 'profile', 'rooms', 'screens', 'files', 'settings'];
    var perfilSubmenuOpen = false;
    var homeSubmenuOpen = false;
    var screensFilterTid = null;
    var playtimeTickInterval = null;

    function $(sel) { return document.querySelector(sel); }
    function $$(sel) { return document.querySelectorAll(sel); }

    function show(el) { if (el) el.classList.remove('hidden'); }
    function hide(el) { if (el) el.classList.add('hidden'); }

    function formatBytes(bytes) {
        if (!bytes) return '0 B';
        var sizes = ['B', 'KB', 'MB', 'GB'];
        var i = Math.floor(Math.log(bytes) / Math.log(1024));
        return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + sizes[i];
    }

    function getTempColor(temp) {
        if (temp < 55) return 'var(--success)';
        if (temp < 70) return 'var(--warning)';
        return 'var(--danger)';
    }

    function getTempClass(temp) {
        if (temp < 55) return 'success';
        if (temp < 70) return 'warning';
        return 'danger';
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    function showToast(message) {
        var existing = document.querySelector('.nova-toast');
        if (existing) existing.remove();
        var toast = document.createElement('div');
        toast.className = 'nova-toast';
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(function() { toast.classList.add('show'); }, 10);
        setTimeout(function() {
            toast.classList.remove('show');
            setTimeout(function() { toast.remove(); }, 300);
        }, 3000);
    }

    function sanitizeBioHtml(bio) {
        if (!bio) return '';
        var s = escapeHtml(String(bio));
        s = s.replace(/&lt;br\s*\/?&gt;/gi, '<br>');
        s = s.replace(/https?:\/\/[^\s<]+/g, function(url) { return escapeHtml(url); });
        return s;
    }

    function fallbackCopy(text) {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); } catch(e) {}
        document.body.removeChild(ta);
    }

    function sanitizeHtml(html) {
        if (!html) return '';
        var s = String(html)
            .replace(/<script[\s\S]*?<\/script>/gi, '')
            .replace(/<script[\s>]/gi, '&lt;script')
            .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
            .replace(/on\w+\s*=\s*[^\s>]*/gi, '')
            .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
            .replace(/<iframe[\s>]/gi, '&lt;iframe')
            .replace(/<object[\s\S]*?<\/object>/gi, '')
            .replace(/<embed[^>]*>/gi, '')
            .replace(/href\s*=\s*["']\s*javascript:/gi, 'href="')
            .replace(/src\s*=\s*["']\s*javascript:/gi, 'src="')
            .replace(/href\s*=\s*["']\s*data:/gi, 'href="')
            .replace(/src\s*=\s*["']\s*data:(?!image\/)/gi, 'src="')
            .replace(/<form[\s\S]*?<\/form>/gi, '')
            .replace(/<form[\s>]/gi, '&lt;form')
            .replace(/<meta[^>]*>/gi, '')
            .replace(/<link[^>]*>/gi, '')
            .replace(/<base[^>]*>/gi, '');
        return s;
    }

    function sanitizeUrl(url) {
        if (!url) return '';
        var u = String(url).trim();
        if (/^javascript:/i.test(u) || /^data:/i.test(u) || /^vbscript:/i.test(u)) return '';
        return u;
    }

    function getOverlayPref() {
        try { var v = localStorage.getItem('nova_ach_overlays'); return v === null ? true : v === '1'; } catch(e) { return true; }
    }
    function setOverlayPref(val) {
        try { localStorage.setItem('nova_ach_overlays', val ? '1' : '0'); } catch(e) {}
    }
    function applyOverlayState(container) {
        var on = getOverlayPref();
        container.querySelectorAll('.achievement-type-overlay').forEach(function(img) { img.style.display = on ? '' : 'none'; });
        if (on) {
            container.classList.remove('ach-overlays-off');
        } else {
            container.classList.add('ach-overlays-off');
        }
    }

    function getGameFilterLabel() {
        var labels = { 'all': 'All', '1': 'Xbox 360', '2': 'Arcade', '3': 'Indie', 'homebrew': 'Homebrew', '4': 'OG Xbox' };
        return labels[state.gameFilter] || 'All';
    }

    function gameTypeLabel(type) {
        var t = String(type);
        var types = {
            '1': 'Xbox 360', '2': 'Arcade', '3': 'Indie', '4': 'OG Xbox', '5': 'Homebrew',
            '6': 'Homebrew', '7': 'Homebrew',
            'Xbox360': 'Xbox 360', 'XBLA': 'Arcade', 'Homebrew': 'Homebrew',
            'XboxClassic': 'OG Xbox', 'Indie': 'Indie', 'Unsigned': 'Homebrew',
            'LibXenon': 'Homebrew'
        };
        return types[t] || (t && t !== '0' && t !== 'undefined' ? t : 'Unknown');
    }

    function getGameName(g) { return g.titleName || g.Name || g.name || ''; }
    function getGameType(g) { return g.contentGroup != null ? g.contentGroup : (g.type != null ? g.type : (g.ContentType || g.contenttype || '')); }
    function getGameArt(g) {
        if (g.art) return g.art.boxartLarge || g.art.boxartSmall || g.art.tile || '';
        return g.BoxArt || g.boxart || '';
    }
    function getGameBanner(g) {
        if (g.art) return g.art.banner || g.art.background || g.art.boxartLarge || '';
        return g.BannerPath || g.BoxArt || g.boxart || '';
    }
    function getGameId(g) { return g.TitleId || g.titleid || g.contentGroup || ''; }
    function getGamePath(g) {
        if (g.directory && g.executable) {
            var dir = g.directory;
            if (dir && dir[dir.length - 1] !== '\\' && dir[dir.length - 1] !== '/') dir += '\\';
            return dir + g.executable;
        }
        return g.Path || g.path || '';
    }

    function getGameScreenshots(g) {
        if (g.art && Array.isArray(g.art.screenshots)) return g.art.screenshots;
        return [];
    }

    function getGameBoxartLarge(g) {
        if (g.art) return g.art.boxartLarge || g.art.boxartSmall || g.art.tile || '';
        return g.BoxArt || g.boxart || '';
    }

    function formatElapsed(ms) {
        if (!ms || ms < 0) return '0s';
        var totalSeconds = Math.floor(ms / 1000);
        var hours = Math.floor(totalSeconds / 3600);
        var minutes = Math.floor((totalSeconds % 3600) / 60);
        var seconds = totalSeconds % 60;
        if (hours > 0) return hours + 'h ' + minutes + 'm';
        if (minutes > 0) return minutes + 'm ' + seconds + 's';
        return seconds + 's';
    }

    function getTitleIdFromState() {
        if (!state.title) return '';
        return state.title.titleid || state.title.TitleId || '';
    }

    function findGameByTitleId(tid) {
        if (!tid) return null;
        var tidLower = tid.toLowerCase();
        return state.games.find(function(g) {
            var gid = getGameId(g);
            return gid && gid.toLowerCase() === tidLower;
        }) || null;
    }

    function isDashboard(ti) {
        if (!ti) return true;
        var tid = ti.titleid || ti.TitleId || '';
        if (!tid || tid === '0x00000000' || tid === '0x00000000') return true;
        var name = ti.Name || ti.name;
        if (name && name.toLowerCase() === 'dashboard') return true;
        return false;
    }

    function navigateTo(page, skipHash) {
        if (pages.indexOf(page) === -1) page = 'home';
        if (page !== 'profile' && page !== 'rooms') {
            closePerfilSubmenu();
        }
        if (page !== 'home' && page !== 'news' && page !== 'events') {
            closeHomeSubmenu();
        }
        if (page !== 'home' && _heroSliderInterval) {
            clearInterval(_heroSliderInterval);
            _heroSliderInterval = null;
        }
        if (page !== 'home') {
            stopNowPlayingTicker();
        }
        state.currentPage = page;
        if (!skipHash) window.location.hash = '#' + page;
        pages.forEach(function(p) {
            var el = $('#page-' + p);
            if (el) {
                el.classList.remove('active');
                if (p === page) el.classList.add('active');
            }
        });
        $$('.nav-item').forEach(function(btn) {
            btn.classList.remove('active');
            var bp = btn.dataset.page;
            if (bp === page) btn.classList.add('active');
            if (bp === 'profile' && (page === 'profile' || page === 'rooms')) btn.classList.add('active');
            if (bp === 'home' && (page === 'home' || page === 'news' || page === 'events')) btn.classList.add('active');
        });
        closeSidebar();
        window.scrollTo(0, 0);
        renderPage(page);
    }

    function clampSubmenuPosition(submenu, anchorRect) {
        submenu.style.left = (anchorRect.left + anchorRect.width / 2) + 'px';
        submenu.style.bottom = (window.innerHeight - anchorRect.top + 4) + 'px';
        requestAnimationFrame(function() {
            var r = submenu.getBoundingClientRect();
            var pad = 8;
            if (r.left < pad) {
                submenu.style.left = (pad + r.width / 2) + 'px';
            } else if (r.right > window.innerWidth - pad) {
                submenu.style.left = (window.innerWidth - pad - r.width / 2) + 'px';
            }
        });
    }

    function togglePerfilSubmenu() {
        var existing = $('#perfil-submenu');
        if (existing) {
            closePerfilSubmenu();
            return;
        }
        closeHomeSubmenu();
        perfilSubmenuOpen = true;
        var navBtn = $('#nav-perfil-btn');
        if (!navBtn) return;
        var rect = navBtn.getBoundingClientRect();
        var submenu = document.createElement('div');
        submenu.id = 'perfil-submenu';
        submenu.className = 'perfil-submenu';
        submenu.innerHTML =
            '<button class="perfil-submenu-item" data-sub-page="profile">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>' +
                ' ' + I18n.t('nav_profile') +
            '</button>' +
            '<button class="perfil-submenu-item" data-sub-page="rooms">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>' +
                ' ' + I18n.t('nav_rooms') +
            '</button>';
        document.body.appendChild(submenu);
        clampSubmenuPosition(submenu, rect);
        submenu.querySelectorAll('.perfil-submenu-item').forEach(function(item) {
            item.addEventListener('click', function(e) {
                e.stopPropagation();
                var target = this.getAttribute('data-sub-page');
                closePerfilSubmenu();
                navigateTo(target);
            });
        });
        setTimeout(function() {
            document.addEventListener('click', closePerfilSubmenuOnClick);
        }, 10);
    }

    function closePerfilSubmenu() {
        perfilSubmenuOpen = false;
        var existing = $('#perfil-submenu');
        if (existing) existing.remove();
        document.removeEventListener('click', closePerfilSubmenuOnClick);
    }

    function closePerfilSubmenuOnClick(e) {
        var submenu = $('#perfil-submenu');
        var navBtn = $('#nav-perfil-btn');
        if (submenu && !submenu.contains(e.target) && navBtn && !navBtn.contains(e.target)) {
            closePerfilSubmenu();
        }
    }

    function toggleHomeSubmenu() {
        var existing = $('#home-submenu');
        if (existing) {
            closeHomeSubmenu();
            return;
        }
        closePerfilSubmenu();
        homeSubmenuOpen = true;
        var navBtn = $('#nav-home-btn');
        if (!navBtn) return;
        var rect = navBtn.getBoundingClientRect();
        var submenu = document.createElement('div');
        submenu.id = 'home-submenu';
        submenu.className = 'perfil-submenu';
        submenu.innerHTML =
            '<button class="perfil-submenu-item" data-sub-page="home">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>' +
                ' ' + I18n.t('nav_home_main') +
            '</button>' +
            '<button class="perfil-submenu-item" data-sub-page="news">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><line x1="10" y1="6" x2="18" y2="6"/><line x1="10" y1="10" x2="18" y2="10"/><line x1="10" y1="14" x2="14" y2="14"/></svg>' +
                ' ' + I18n.t('nav_news') +
            '</button>' +
            '<button class="perfil-submenu-item" data-sub-page="events">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>' +
                ' ' + I18n.t('nav_events') +
            '</button>';
        document.body.appendChild(submenu);
        clampSubmenuPosition(submenu, rect);
        submenu.querySelectorAll('.perfil-submenu-item').forEach(function(item) {
            item.addEventListener('click', function(e) {
                e.stopPropagation();
                var target = this.getAttribute('data-sub-page');
                closeHomeSubmenu();
                navigateTo(target);
            });
        });
        setTimeout(function() {
            document.addEventListener('click', closeHomeSubmenuOnClick);
        }, 10);
    }

    function closeHomeSubmenu() {
        homeSubmenuOpen = false;
        var existing = $('#home-submenu');
        if (existing) existing.remove();
        document.removeEventListener('click', closeHomeSubmenuOnClick);
    }

    function closeHomeSubmenuOnClick(e) {
        var submenu = $('#home-submenu');
        var navBtn = $('#nav-home-btn');
        if (submenu && !submenu.contains(e.target) && navBtn && !navBtn.contains(e.target)) {
            closeHomeSubmenu();
        }
    }

    function getPageFromHash() {
        var h = window.location.hash.replace('#', '');
        if (h.indexOf('novidades/') === 0 || h.indexOf('news/') === 0) return 'news';
        if (h === 'novidades') return 'news';
        if (h.indexOf('events/') === 0) return 'events';
        return pages.indexOf(h) !== -1 ? h : 'home';
    }

    function closeSidebar() {
        var sb = $('#sidebar');
        var overlay = $('#sidebar-overlay');
        if (sb) { sb.classList.remove('open'); hide(sb); }
        if (overlay) hide(overlay);
    }

    function openSidebar() {
        var sb = $('#sidebar');
        var overlay = $('#sidebar-overlay');
        if (sb) { show(sb); setTimeout(function(){ sb.classList.add('open'); }, 10); }
        if (overlay) show(overlay);
    }

    function renderPage(page) {
        switch(page) {
            case 'home': renderHome(); break;
            case 'news': renderNews(); break;
            case 'events': renderEvents(); break;
            case 'games': renderGames(); break;
            case 'profile': renderProfile(); break;
            case 'rooms': renderRooms(); break;
            case 'screens': renderScreens(); break;
            case 'files': fmRestoreAndInit(); break;
            case 'settings': renderSettings(); break;
        }
    }

    function formatPlaytime(minutes) {
        if (!minutes || minutes <= 0) return '0min';
        minutes = Math.round(minutes);
        if (minutes <= 0) return '0min';
        var h = Math.floor(minutes / 60);
        var m = minutes % 60;
        if (h > 0) {
            if (m > 0) return h + ':' + (m < 10 ? '0' + m : m) + 'hr';
            return h + 'hr';
        }
        return m + 'min';
    }

    function isCmsLoggedIn() {
        return !!NovaAPI.getCmsAuthToken() && !!NovaAPI.getCmsProfileData();
    }

    function postPlaytimeToServer(titleId, minutes, isFirst) {
        var cp = state.cmsProfile;
        if (!cp || !cp.id) return;
        if (minutes <= 0 && !isFirst) return;

        function doPostStats(gameId) {
            NovaAPI.postGameStats(cp.id, {
                game_id: gameId,
                title_id: titleId,
                playtime_minutes: Math.round(minutes * 100) / 100,
                times_launched: isFirst ? 1 : 0,
                completed: false
            }, function(err2) {
                if (err2) {
                    console.log('[STATS] Failed to post game stats:', err2.message);
                    return;
                }
                if (minutes > 0) {
                    if (state.cmsStats) {
                        state.cmsStats.total_playtime_minutes = (state.cmsStats.total_playtime_minutes || 0) + minutes;
                    } else if (state.cmsProfile) {
                        state.cmsProfile.total_playtime_minutes = (state.cmsProfile.total_playtime_minutes || 0) + minutes;
                    }
                    if (state.currentPage === 'home') renderHome();
                }
            });
        }

        NovaAPI.cmsLookupGameByTitleId(titleId, function(err, data) {
            if (!err && data && data.game) {
                doPostStats(data.game.id);
                return;
            }
            var matchedGame = findGameByTitleId(titleId);
            var gameName = matchedGame ? getGameName(matchedGame) : '';
            if (!gameName && state.title) {
                gameName = state.title.Name || state.title.name || '';
            }
            if (!gameName) gameName = 'Unknown (' + titleId + ')';
            var gameType = matchedGame ? getGameType(matchedGame) : 1;
            var platformMap = { 1: 'xbox360', 2: 'arcade', 3: 'og_xbox', 5: 'homebrew' };
            var platform = platformMap[gameType] || 'xbox360';
            var artUrl = matchedGame ? getGameArt(matchedGame) : '';
            var statsPayload = {
                title_id: titleId,
                game_name: gameName,
                platform: platform,
                playtime_minutes: Math.round(minutes * 100) / 100,
                times_launched: isFirst ? 1 : 0,
                completed: false
            };
            if (artUrl) statsPayload.cover_image_url = artUrl;
            NovaAPI.postGameStats(cp.id, statsPayload, function(err2) {
                if (err2) {
                    console.log('[STATS] Failed to post game stats (auto-register):', err2.message);
                    return;
                }
                console.log('[STATS] Posted stats for unregistered game:', gameName);
                if (minutes > 0 && state.cmsStats) {
                    state.cmsStats.total_playtime_minutes = (state.cmsStats.total_playtime_minutes || 0) + minutes;
                }
                state.playtimeCheckpoint = Date.now();
            });
        });
    }

    function flushPlaytimeDelta(titleId) {
        if (!titleId || !state.playtimeCheckpoint) return;
        var now = Date.now();
        var delta = (now - state.playtimeCheckpoint) / 60000;
        state.playtimeCheckpoint = now;
        var isFirst = !state.playtimeFirstSent;
        state.playtimeFirstSent = true;
        postPlaytimeToServer(titleId, delta, isFirst);
    }

    function startPlaytimeAutoSave(titleId) {
        stopPlaytimeAutoSave();
        if (!isCmsLoggedIn() || !titleId) return;
        state.playtimeCheckpoint = Date.now();
        state.playtimeFirstSent = false;
        playtimeTickInterval = setInterval(function() {
            if (!isCmsLoggedIn() || !state.lastTitleId || isDashboard(state.title)) {
                stopPlaytimeAutoSave();
                return;
            }
            flushPlaytimeDelta(state.lastTitleId);
        }, 211000);
    }

    function stopPlaytimeAutoSave() {
        if (playtimeTickInterval) {
            clearInterval(playtimeTickInterval);
            playtimeTickInterval = null;
        }
        state.playtimeCheckpoint = null;
    }

    function checkOnlineStatus() {
        if (!navigator.onLine) {
            setOnlineState(false);
            return;
        }
        NovaAPI.checkOnline(function(online) {
            setOnlineState(online);
        });
    }

    function setOnlineState(online) {
        var changed = state.isOnline !== online;
        state.isOnline = online;
        updateOfflineBanner();
        updateOfflineNav();
        if (changed && state.currentPage !== 'files') {
            renderPage(state.currentPage);
        }
    }

    function updateOfflineBanner() {
        var existing = $('#offline-banner');
        if (!state.isOnline) {
            if (!existing) {
                var banner = document.createElement('div');
                banner.id = 'offline-banner';
                banner.className = 'offline-banner';
                banner.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/><path d="M10.71 5.05A16 16 0 0 1 22.56 9"/><path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg> Offline — apenas recursos do console disponíveis';
                var mainContent = $('#main-content');
                if (mainContent) mainContent.parentNode.insertBefore(banner, mainContent);
            }
        } else {
            if (existing) existing.remove();
        }
    }

    function updateOfflineNav() {
        var roomsNav = document.querySelector('.nav-item[data-page="rooms"]');
        var roomsSidebar = document.querySelector('.sidebar-link[data-page="rooms"]');
        if (!state.isOnline) {
            if (roomsNav) roomsNav.style.display = 'none';
            if (roomsSidebar) roomsSidebar.style.display = 'none';
        } else {
            if (roomsNav) roomsNav.style.display = '';
            if (roomsSidebar) roomsSidebar.style.display = '';
        }
    }

    function loadCmsProfileData() {
        var profile = NovaAPI.getCmsProfileData();
        if (!profile || !profile.id) return;
        state.cmsProfile = profile;

        NovaAPI.getCmsProfile(function(err, freshProfile) {
            if (!err && freshProfile) {
                state.cmsProfile = freshProfile;
                NovaAPI.setCmsProfileData(freshProfile);
                if (state.currentPage === 'home') renderHome();
            }
        });

        NovaAPI.getCmsStats(profile.id, function(err, data) {
            if (!err && data) {
                state.cmsStats = data.stats;
                state.cmsRecentAchievements = data.recent_achievements || [];
                if (state.currentPage === 'home') renderHome();
            }
        });

        NovaAPI.getNotifications(profile.id, function(err, data) {
            if (!err && data) {
                state.cmsNotifications = data;
                if (state.currentPage === 'home') renderHome();
            }
        });
    }

    function renderCmsLoginSection() {
        return '<div class="section-title">GodStix Account</div>' +
            '<div class="cms-login-card card">' +
                '<div class="cms-login-header">' +
                    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="24" height="24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>' +
                    '<div class="cms-login-title">Entrar na sua conta</div>' +
                '</div>' +
                '<form id="cms-login-form" class="cms-login-form">' +
                    '<div class="cms-login-field">' +
                        '<input type="text" id="cms-login-email" placeholder="Email ou username" autocomplete="email" autocapitalize="off">' +
                    '</div>' +
                    '<div class="cms-login-field">' +
                        '<input type="password" id="cms-login-password" placeholder="Senha" autocomplete="current-password">' +
                    '</div>' +
                    '<p id="cms-login-error" class="cms-login-error hidden"></p>' +
                    '<button type="submit" class="btn btn-primary btn-block" id="cms-login-btn">' +
                        '<span id="cms-login-btn-text">Entrar</span>' +
                        '<div id="cms-login-spinner" class="loader-spinner small hidden"></div>' +
                    '</button>' +
                '</form>' +
                '<div class="cms-login-signup">' +
                    '<a href="https://speedygamesdownloads.com/register" target="_blank" rel="noopener">Criar conta em speedygamesdownloads.com</a>' +
                '</div>' +
            '</div>';
    }

    function renderCmsProfileSection() {
        var cp = state.cmsProfile;
        if (!cp) return '';

        var avatarInitial = (cp.display_name || cp.username || '?')[0].toUpperCase();
        var avatarHtml = cp.avatar_url
            ? '<img class="cms-profile-avatar" src="' + escapeHtml(cp.avatar_url) + '" alt="" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'">' +
              '<div class="cms-profile-avatar-fallback" style="display:none">' + escapeHtml(avatarInitial) + '</div>'
            : '<div class="cms-profile-avatar-fallback">' + escapeHtml(avatarInitial) + '</div>';

        var levelBadge = cp.level_name
            ? '<span class="cms-level-badge">' + escapeHtml(cp.level_name) + '</span>'
            : '';

        var unreadCount = 0;
        if (state.cmsNotifications && state.cmsNotifications.unread_count) {
            unreadCount = state.cmsNotifications.unread_count;
        }

        var notifBell = '<button class="cms-notif-bell" id="cms-notif-bell" title="Notificações">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>' +
            (unreadCount > 0 ? '<span class="cms-notif-count">' + (unreadCount > 9 ? '9+' : unreadCount) + '</span>' : '') +
        '</button>';

        var html = '<div class="section-title">GodStix Account ' + notifBell + '</div>' +
            '<div class="cms-profile-card card">' +
                '<div class="cms-profile-header">' +
                    '<div class="cms-profile-avatar-wrap">' + avatarHtml + '</div>' +
                    '<div class="cms-profile-info">' +
                        '<div class="cms-profile-name">' + escapeHtml(cp.display_name || cp.username) + (levelBadge ? ' <span class="cms-level-inline">(' + escapeHtml(cp.level_name) + ')</span>' : '') + '</div>' +
                    '</div>' +
                    '<button class="cms-logout-btn" id="cms-logout-btn" title="Sair">' +
                        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>' +
                    '</button>' +
                '</div>';

        var stats = state.cmsStats || cp;
        html += '<div class="cms-stats-grid">' +
            '<div class="cms-stat-item"><div class="cms-stat-value">' + (stats.total_downloads || 0) + '</div><div class="cms-stat-label">Downloads</div></div>' +
            '<div class="cms-stat-item"><div class="cms-stat-value">' + formatPlaytime(stats.total_playtime_minutes || 0) + '</div><div class="cms-stat-label">Playtime</div></div>' +
            '<div class="cms-stat-item"><div class="cms-stat-value">' + (stats.achievements_count || 0) + '</div><div class="cms-stat-label">Conquistas</div></div>' +
            '<div class="cms-stat-item"><div class="cms-stat-value">' + (stats.games_completed || 0) + '</div><div class="cms-stat-label">Completos</div></div>' +
        '</div>';

        var stixAchievements = (state.cmsRecentAchievements || []).filter(function(a) {
            return !a.achievement_key || a.achievement_key.indexOf('xbox_') !== 0;
        });
        if (stixAchievements.length > 0) {
            html += '<div class="cms-achievements-title"><span class="cms-ach-badge-stix">STIX</span> Conquistas Stix</div>' +
                '<div class="cms-achievements-list">';
            stixAchievements.forEach(function(ach) {
                var iconContent = (ach.icon && ach.icon.length <= 4) ? ach.icon : '';
                var iconHtml = iconContent
                    ? '<span class="cms-ach-icon-emoji">' + iconContent + '</span>'
                    : (ach.icon
                        ? '<img class="cms-ach-icon-img" src="' + escapeHtml(ach.icon) + '" alt="">'
                        : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><path d="M12 15l-2 5 2-1 2 1-2-5z"/><circle cx="12" cy="8" r="6"/></svg>');
                var dateStr = '';
                if (ach.unlocked_at) {
                    try { dateStr = new Date(ach.unlocked_at).toLocaleDateString('pt-BR'); } catch(e) {}
                }
                html += '<div class="cms-ach-item">' +
                    '<div class="cms-ach-icon">' + iconHtml + '</div>' +
                    '<div class="cms-ach-info">' +
                        '<div class="cms-ach-name">' + escapeHtml(ach.achievement_name) + '</div>' +
                        '<div class="cms-ach-desc">' + escapeHtml(ach.achievement_description || '') +
                            (dateStr ? ' <span class="cms-ach-date">' + dateStr + '</span>' : '') +
                        '</div>' +
                    '</div>' +
                '</div>';
            });
            html += '</div>';
        }

        html += '</div>';
        return html;
    }

    function bindCmsLogin(onSuccessClose) {
        var form = $('#cms-login-form');
        if (!form) return;

        form.addEventListener('submit', function(e) {
            e.preventDefault();
            var email = $('#cms-login-email').value.trim();
            var password = $('#cms-login-password').value;
            var errorEl = $('#cms-login-error');
            var btnText = $('#cms-login-btn-text');
            var btnSpinner = $('#cms-login-spinner');
            var submitBtn = $('#cms-login-btn');

            if (!email || !password) {
                show(errorEl);
                errorEl.textContent = 'Preencha email e senha';
                return;
            }

            hide(errorEl);
            hide(btnText);
            show(btnSpinner);
            submitBtn.disabled = true;

            NovaAPI.cmsLogin(email, password, function(err, data) {
                show(btnText);
                hide(btnSpinner);
                submitBtn.disabled = false;

                if (err) {
                    show(errorEl);
                    errorEl.textContent = err.message || 'Falha no login';
                    return;
                }

                state.cmsProfile = data.profile;
                loadCmsProfileData();
                if (onSuccessClose) onSuccessClose();
                renderHome();

                var activeTid = state.lastTitleId;
                if (activeTid && !isDashboard(state.title) && !playtimeTickInterval) {
                    startPlaytimeAutoSave(activeTid);
                }

                completePushRegistration();

                batchAutoRegisterGames();
            });
        });
    }

    function completePushRegistration() {
        var token = NovaAPI.getCmsAuthToken();
        if (!token) return;
        var cmsUrl = NovaAPI.getCmsUrl();
        var httpsUrl = cmsUrl.replace(/^http:/, 'https:');

        if (location.protocol === 'https:') {
            if ('Notification' in window && Notification.permission === 'granted') {
                NovaAPI.registerPushSubscription(function() {});
            }
            return;
        }

        var iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = httpsUrl + '/pwa/push-complete.html';
        document.body.appendChild(iframe);

        var done = false;
        var expectedOrigin = new URL(httpsUrl).origin;
        function onMessage(e) {
            if (done) return;
            if (!e.data) return;
            if (e.origin !== expectedOrigin) return;
            if (e.data.type === 'push-ready') {
                iframe.contentWindow.postMessage({
                    type: 'push-register',
                    token: token,
                    cmsUrl: httpsUrl
                }, expectedOrigin);
            } else if (e.data.type === 'push-result') {
                done = true;
                window.removeEventListener('message', onMessage);
                setTimeout(function() { try { iframe.remove(); } catch(x) {} }, 1000);
                if (e.data.success) {
                    try { localStorage.setItem('godstix_push_registered', '1'); } catch(x) {}
                }
            }
        }

        window.addEventListener('message', onMessage);

        setTimeout(function() {
            if (!done) {
                done = true;
                window.removeEventListener('message', onMessage);
                try { iframe.remove(); } catch(x) {}
            }
        }, 15000);
    }

    function disablePushNotifications(callback) {
        var token = NovaAPI.getCmsAuthToken();
        var cmsUrl = NovaAPI.getCmsUrl();
        var httpsUrl = cmsUrl.replace(/^http:/, 'https:');

        function unsubBackend() {
            var xhr = new XMLHttpRequest();
            xhr.open('POST', httpsUrl + '/api/profile/push/unsubscribe', true);
            xhr.setRequestHeader('Content-Type', 'application/json');
            if (token) xhr.setRequestHeader('Authorization', 'Bearer ' + token);
            xhr.onload = function() { callback && callback(); };
            xhr.onerror = function() { callback && callback(); };
            xhr.send('{}');
        }

        if ('serviceWorker' in navigator && location.protocol === 'https:') {
            navigator.serviceWorker.getRegistration().then(function(reg) {
                if (!reg) return unsubBackend();
                return reg.pushManager.getSubscription().then(function(sub) {
                    if (sub) return sub.unsubscribe();
                }).then(function() { unsubBackend(); });
            }).catch(function() { unsubBackend(); });
        } else if (location.protocol === 'http:') {
            var iframe = document.createElement('iframe');
            iframe.style.display = 'none';
            iframe.src = httpsUrl + '/pwa/push-complete.html';
            document.body.appendChild(iframe);

            var done = false;
            var expectedOrigin2 = new URL(httpsUrl).origin;
            function onMsg(e) {
                if (done) return;
                if (!e.data) return;
                if (e.origin !== expectedOrigin2) return;
                if (e.data.type === 'push-ready') {
                    iframe.contentWindow.postMessage({ type: 'push-unsubscribe' }, expectedOrigin2);
                } else if (e.data.type === 'push-unsubscribe-result') {
                    done = true;
                    window.removeEventListener('message', onMsg);
                    try { iframe.remove(); } catch(x) {}
                    unsubBackend();
                }
            }
            window.addEventListener('message', onMsg);
            setTimeout(function() {
                if (!done) {
                    done = true;
                    window.removeEventListener('message', onMsg);
                    try { iframe.remove(); } catch(x) {}
                    unsubBackend();
                }
            }, 8000);
        } else {
            unsubBackend();
        }
    }

    function bindCmsLogout() {
        var btn = $('#cms-logout-btn');
        if (!btn) return;
        btn.addEventListener('click', function() {
            NovaAPI.cmsUpdateOnlineStatus(false, null);
            NovaAPI.cmsLogout();
            state.cmsProfile = null;
            state.cmsStats = null;
            state.cmsNotifications = null;
            state.cmsRecentAchievements = null;
            renderHome();
        });
    }

    var _heroSliderInterval = null;
    var _homeSearchDebounce = null;

    function renderHome(liveOnly) {
        var el = $('#page-home');

        var cmsLoginActive = false;
        var cmsLoginValues = null;
        if (!liveOnly) {
            var existingEmailInput = $('#cms-login-email');
            if (existingEmailInput) {
                var emailVal = existingEmailInput.value;
                var passVal = ($('#cms-login-password') || {}).value || '';
                if (emailVal || passVal) {
                    cmsLoginActive = true;
                    cmsLoginValues = { email: emailVal, password: passVal };
                }
            }
        }

        if (liveOnly) {
            updateHomeTopBarLive();
            updateHomeNowPlaying();
            return;
        }

        if (cmsLoginActive && !isCmsLoggedIn()) {
            updateHomeTopBarLive();
            return;
        }

        if (_heroSliderInterval) { clearInterval(_heroSliderInterval); _heroSliderInterval = null; }

        var loggedIn = isCmsLoggedIn();
        var cp = state.cmsProfile;

        var avatarHtml = '';
        if (loggedIn && cp) {
            var avatarInitial = (cp.display_name || cp.username || '?')[0].toUpperCase();
            avatarHtml = cp.avatar_url
                ? '<img class="hb-avatar-img" src="' + escapeHtml(cp.avatar_url) + '" alt="" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'">' +
                  '<div class="hb-avatar-fallback" style="display:none">' + escapeHtml(avatarInitial) + '</div>'
                : '<div class="hb-avatar-fallback">' + escapeHtml(avatarInitial) + '</div>';
        } else {
            avatarHtml = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="22" height="22"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
        }

        var unreadCount = 0;
        if (state.cmsNotifications && state.cmsNotifications.unread_count) {
            unreadCount = state.cmsNotifications.unread_count;
        }
        var notifBadge = unreadCount > 0 ? '<span class="hb-notif-badge">' + (unreadCount > 9 ? '9+' : unreadCount) + '</span>' : '';

        var topBarHtml = '<div class="home-topbar">' +
            '<button class="hb-avatar-btn" id="hb-avatar-btn" title="' + (loggedIn ? I18n.t('nav_profile') : I18n.t('cms_login_title')) + '">' +
                avatarHtml +
            '</button>' +
            '<div class="hb-search-wrap">' +
                '<svg class="hb-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>' +
                '<input type="text" class="hb-search-input" id="hb-search-input" placeholder="' + escapeHtml(I18n.t('home_search_placeholder')) + '" autocomplete="off" autocapitalize="off">' +
                '<div class="hb-search-results hidden" id="hb-search-results"></div>' +
            '</div>' +
            '<button class="hb-notif-btn" id="hb-notif-btn" title="' + I18n.t('home_notifications') + '">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>' +
                notifBadge +
            '</button>' +
        '</div>';

        var heroHtml = '<div class="home-hero-slider" id="home-hero-slider"><div class="home-hero-track" id="home-hero-track"></div><div class="home-hero-dots" id="home-hero-dots"></div></div>';

        var ejectLabel = state.xbdmTrayOpen ? I18n.t('home_inject') : I18n.t('home_eject');
        var ejectIcon = state.xbdmTrayOpen
            ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M12 22L2 10h20L12 22z"/><rect x="2" y="4" width="20" height="3" rx="1"/></svg>'
            : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M12 2L2 14h20L12 2z"/><rect x="2" y="17" width="20" height="3" rx="1"/></svg>';
        var controlsHtml = '<div class="home-controls-row" id="home-controls-row">' +
            '<button class="home-cat-btn" id="hcr-restart-aurora" title="' + I18n.t('home_restart_aurora') + '">' +
                '<span class="home-cat-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg></span>' +
                '<span class="home-cat-label">' + I18n.t('home_restart_aurora') + '</span>' +
            '</button>' +
            '<button class="home-cat-btn" id="hcr-eject" title="' + ejectLabel + '">' +
                '<span class="home-cat-icon" id="hcr-eject-icon">' + ejectIcon + '</span>' +
                '<span class="home-cat-label" id="hcr-eject-label">' + ejectLabel + '</span>' +
            '</button>' +
            '<button class="home-cat-btn" id="hcr-restart-game" title="' + I18n.t('home_restart_game') + '">' +
                '<span class="home-cat-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><polygon points="5 3 19 12 5 21 5 3"/></svg></span>' +
                '<span class="home-cat-label">' + I18n.t('home_restart_game') + '</span>' +
            '</button>' +
            '<button class="home-cat-btn" id="hcr-restart-console" title="' + I18n.t('home_restart_console') + '">' +
                '<span class="home-cat-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M18.36 6.64A9 9 0 1 1 5.64 6.64"/><line x1="12" y1="2" x2="12" y2="12"/></svg></span>' +
                '<span class="home-cat-label">' + I18n.t('home_restart_console') + '</span>' +
            '</button>' +
            '<button class="home-cat-btn" id="hcr-fan-speed" title="' + I18n.t('home_fan_speed') + '">' +
                '<span class="home-cat-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M12 12c-1 -4 -4 -7 -8 -7c2 4 1 7 1 7s-1 3 1 7c4 0 7 -3 8 -7z"/><path d="M12 12c4 -1 7 -4 7 -8c-4 2 -7 1 -7 1s-3 -1 -7 1c0 4 3 7 7 8z"/><path d="M12 12c1 4 4 7 8 7c-2 -4 -1 -7 -1 -7s1 -3 -1 -7c-4 0 -7 3 -8 7z"/><path d="M12 12c-4 1 -7 4 -7 8c4 -2 7 -1 7 -1s3 1 7 -1c0 -4 -3 -7 -7 -8z"/><circle cx="12" cy="12" r="2"/></svg></span>' +
                '<span class="home-cat-label">' + I18n.t('home_fan_speed') + '</span>' +
            '</button>' +
        '</div>' +
        '<div class="home-controls-dots" id="home-controls-dots"></div>';

        var nowPlayingHtml = '<div id="home-now-playing-wrap">' + buildNowPlayingHtml() + '</div>';

        var roomInviteHtml = '<div id="home-room-invites"></div>';

        var newsHtml = state.isOnline ? '<div class="home-section" id="home-news-section"></div>' : '';

        var eventsSection = state.isOnline ? '<div class="home-section" id="home-events-section"></div>' : '';

        var popularHtml = '<div class="home-section" id="home-popular-games">' +
            '<div class="home-section-header">' +
                '<span class="home-section-title">' + I18n.t('home_popular') + '</span>' +
                '<button class="home-section-more" data-nav="games">' + I18n.t('home_see_all') + '</button>' +
            '</div>' +
            '<div class="home-hscroll" id="home-popular-scroll"></div>' +
        '</div>';

        var cmsGamesHtml = state.isOnline ? '<div class="home-section" id="home-cms-games-section"></div>' : '';

        el.innerHTML = topBarHtml + heroHtml + controlsHtml + nowPlayingHtml + roomInviteHtml + newsHtml + eventsSection + popularHtml + cmsGamesHtml;

        bindHomeTopBar(loggedIn, cmsLoginValues);
        bindHomeSearch();
        bindHomeControlsRow();
        bindHomeNowPlaying();
        startNowPlayingTicker();
        loadHomeHeroSlider();
        loadHomePopularGames();
        if (state.isOnline) {
            loadHomeNews();
            loadHomeEvents();
            loadHomeCmsGames();
        }
        loadHomeRoomInvites();
    }

    var _npTickerInterval = null;

    function buildNowPlayingHtml() {
        var titleHtml = '';
        if (state.title) {
            var ti = state.title;
            var currentTid = ti.titleid || ti.TitleId || '';
            var matchedGame = findGameByTitleId(currentTid);
            var npName = matchedGame ? getGameName(matchedGame) : (ti.Name || ti.name || 'Dashboard');
            var npIsDash = isDashboard(ti);

            if (npIsDash) {
                titleHtml = '<div class="section-title">Now Playing</div>' +
                    '<div class="card now-playing-card">' +
                        '<div class="now-playing-info">' +
                            '<div class="now-playing-name">Aurora Dashboard</div>' +
                            '<div class="now-playing-detail">' + I18n.t('home_no_game_running') + '</div>' +
                        '</div>' +
                    '</div>';
            } else {
                var npArt = matchedGame ? getGameArt(matchedGame) : '';
                var npArtAttr = npArt ? 'data-auth-src="' + escapeHtml(npArt) + '"' : 'src="img/noboxart.svg"';
                var elapsed = state.titleStartTime ? formatElapsed(Date.now() - state.titleStartTime) : '';
                var npType = matchedGame ? gameTypeLabel(getGameType(matchedGame)) : '';
                var npClickAttr = currentTid ? ' data-np-tid="' + escapeHtml(currentTid) + '"' : '';

                titleHtml = '<div class="section-title">Now Playing</div>' +
                    '<div class="card now-playing-card' + (currentTid ? ' clickable' : '') + '"' + npClickAttr + '>' +
                        '<img class="now-playing-art" ' + npArtAttr + ' alt="" onerror="this.onerror=null;this.src=\'img/noboxart.svg\'">' +
                        '<div class="now-playing-info">' +
                            '<div class="now-playing-name">' + escapeHtml(npName) + '</div>' +
                            '<div class="now-playing-detail">' +
                                (npType ? '<span class="badge badge-accent">' + npType + '</span> ' : '') +
                                '<span style="font-family:monospace;font-size:11px;color:var(--text-muted)">' + escapeHtml(currentTid) + '</span>' +
                            '</div>' +
                            (elapsed ? '<div class="now-playing-elapsed"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12" style="vertical-align:-1px"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> ' + elapsed + '</div>' : '') +
                        '</div>' +
                        (isCmsLoggedIn() ? '<button class="btn btn-sm np-save-playtime-btn" data-np-save-tid="' + escapeHtml(currentTid) + '" title="' + I18n.t('np_save_playtime_title') + '" style="margin-left:auto;padding:4px 10px;font-size:11px;white-space:nowrap;flex-shrink:0"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12" style="vertical-align:-1px"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> ' + I18n.t('np_save_playtime') + '</button>' : '') +
                    '</div>';
            }
        } else {
            titleHtml = '<div class="section-title">Now Playing</div>' +
                '<div class="card now-playing-card">' +
                    '<div class="now-playing-info">' +
                        '<div class="now-playing-name">Aurora Dashboard</div>' +
                        '<div class="now-playing-detail">' + I18n.t('home_no_game_running') + '</div>' +
                    '</div>' +
                '</div>';
        }
        return titleHtml;
    }

    function bindHomeNowPlaying() {
        var npCard = document.querySelector('.now-playing-card[data-np-tid]');
        if (npCard) {
            npCard.addEventListener('click', function() {
                var tid = this.getAttribute('data-np-tid');
                if (tid && state.games.length > 0) {
                    navigateTo('games');
                    setTimeout(function() { showGameDetail(tid); }, 100);
                } else if (tid) {
                    navigateTo('games');
                }
            });
        }

        var npArt = document.querySelector('.now-playing-art[data-auth-src]');
        if (npArt) {
            NovaAPI.loadAuthImage(npArt.getAttribute('data-auth-src'), npArt);
        }

        var saveBtn = document.querySelector('.np-save-playtime-btn[data-np-save-tid]');
        if (saveBtn) {
            saveBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                var tid = this.getAttribute('data-np-save-tid');
                if (!tid || !state.playtimeCheckpoint) {
                    showToast(I18n.t('np_save_playtime_no_data'));
                    return;
                }
                this.disabled = true;
                var btn = this;
                flushPlaytimeDelta(tid);
                showToast(I18n.t('np_save_playtime_success'));
                setTimeout(function() { btn.disabled = false; }, 3000);
            });
        }
    }

    function updateHomeNowPlaying() {
        var wrap = $('#home-now-playing-wrap');
        if (!wrap) return;
        wrap.innerHTML = buildNowPlayingHtml();
        bindHomeNowPlaying();
        startNowPlayingTicker();
    }

    function startNowPlayingTicker() {
        stopNowPlayingTicker();
        if (state.title && !isDashboard(state.title) && state.titleStartTime) {
            _npTickerInterval = setInterval(function() {
                var elapsedEl = document.querySelector('#home-now-playing-wrap .now-playing-elapsed');
                if (elapsedEl && state.titleStartTime) {
                    var elapsed = formatElapsed(Date.now() - state.titleStartTime);
                    elapsedEl.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12" style="vertical-align:-1px"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> ' + elapsed;
                }
            }, 1000);
        }
    }

    function stopNowPlayingTicker() {
        if (_npTickerInterval) {
            clearInterval(_npTickerInterval);
            _npTickerInterval = null;
        }
    }

    function updateHomeTopBarLive() {
        var bellBtn = $('#hb-notif-btn');
        if (bellBtn) {
            var unreadCount = 0;
            if (state.cmsNotifications && state.cmsNotifications.unread_count) {
                unreadCount = state.cmsNotifications.unread_count;
            }
            var existingBadge = bellBtn.querySelector('.hb-notif-badge');
            if (unreadCount > 0) {
                if (existingBadge) {
                    existingBadge.textContent = unreadCount > 9 ? '9+' : unreadCount;
                } else {
                    var badge = document.createElement('span');
                    badge.className = 'hb-notif-badge';
                    badge.textContent = unreadCount > 9 ? '9+' : unreadCount;
                    bellBtn.appendChild(badge);
                }
            } else if (existingBadge) {
                existingBadge.remove();
            }
        }
    }

    function bindHomeTopBar(loggedIn, cmsLoginValues) {
        var avatarBtn = $('#hb-avatar-btn');
        if (avatarBtn) {
            avatarBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                var existing = $('#home-profile-popup');
                if (existing) { existing.remove(); var ov = $('#home-popup-overlay'); if (ov) ov.remove(); return; }
                if (loggedIn) {
                    showHomeProfilePopup();
                } else {
                    showHomeLoginPopup(cmsLoginValues);
                }
            });
        }

        var notifBtn = $('#hb-notif-btn');
        if (notifBtn) {
            notifBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                if (loggedIn) {
                    showNotificationPanel(notifBtn);
                } else {
                    showHomeLoginPopup(cmsLoginValues);
                }
            });
        }
    }

    function showHomeProfilePopup() {
        var existing = $('#home-profile-popup');
        if (existing) { existing.remove(); var ov = $('#home-popup-overlay'); if (ov) ov.remove(); return; }

        var cp = state.cmsProfile;
        if (!cp) return;

        var avatarInitial = (cp.display_name || cp.username || '?')[0].toUpperCase();
        var avatarHtml = cp.avatar_url
            ? '<img class="hpp-avatar-img" src="' + escapeHtml(cp.avatar_url) + '" alt="" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'">' +
              '<div class="hpp-avatar-fallback" style="display:none">' + escapeHtml(avatarInitial) + '</div>'
            : '<div class="hpp-avatar-fallback">' + escapeHtml(avatarInitial) + '</div>';

        var levelBadge = cp.level_name ? '<span class="hpp-level">' + escapeHtml(cp.level_name) + '</span>' : '';

        var stats = state.cmsStats || cp;
        var statsHtml = '<div class="hpp-stats-grid">' +
            '<div class="hpp-stat-card">' +
                '<div class="hpp-stat-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="22" height="22"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></div>' +
                '<div class="hpp-stat-val">' + (stats.total_downloads || 0) + '</div>' +
                '<div class="hpp-stat-lbl">Downloads</div>' +
            '</div>' +
            '<div class="hpp-stat-card">' +
                '<div class="hpp-stat-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="22" height="22"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div>' +
                '<div class="hpp-stat-val">' + formatPlaytime(stats.total_playtime_minutes || 0) + '</div>' +
                '<div class="hpp-stat-lbl">Playtime</div>' +
            '</div>' +
            '<div class="hpp-stat-card">' +
                '<div class="hpp-stat-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="22" height="22"><path d="M6 11V7a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v4"/><path d="M4 15v-1a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1"/><path d="M6 19a2 2 0 0 1-2-2v-2h4l2 2h4l2-2h4v2a2 2 0 0 1-2 2H6z"/><circle cx="9" cy="10" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="10" r="1" fill="currentColor" stroke="none"/></svg></div>' +
                '<div class="hpp-stat-val">' + (stats.achievements_count || 0) + '</div>' +
                '<div class="hpp-stat-lbl">' + I18n.t('profile_xbox_achievements').split(' ').pop() + '</div>' +
            '</div>' +
        '</div>';

        function buildGaugeHtml(label, value, unit, min, max, gradientClass) {
            var pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
            return '<div class="hpp-gauge">' +
                '<div class="hpp-gauge-head">' +
                    '<span class="hpp-gauge-label">' + label + '</span>' +
                    '<span class="hpp-gauge-value">' + value + unit + '</span>' +
                '</div>' +
                '<div class="hpp-gauge-track ' + gradientClass + '">' +
                    '<div class="hpp-gauge-marker" style="left:' + pct + '%"></div>' +
                '</div>' +
                '<div class="hpp-gauge-scale">' +
                    '<span>' + min + '</span><span>' + Math.round((max - min) * 0.33 + min) + '</span><span>' + Math.round((max - min) * 0.66 + min) + '</span><span>' + max + '</span>' +
                '</div>' +
            '</div>';
        }

        var liveHtml = '';
        if (state.temperature || state.memory) {
            liveHtml += '<div class="hpp-gauges-grid">';
            var t = state.temperature || {};
            var gpuTemp = t.gpu || t.GPU || 0;
            var cpuTemp = t.cpu || t.CPU || 0;
            liveHtml += buildGaugeHtml('GPU', gpuTemp, '°C', 0, 100, 'hpp-gauge-temp');
            liveHtml += buildGaugeHtml('CPU', cpuTemp, '°C', 0, 100, 'hpp-gauge-temp');

            var memTemp = t.memory || t.mem || t.MEM || t.ram || t.RAM || 0;
            liveHtml += buildGaugeHtml('RAM', memTemp, '°C', 0, 100, 'hpp-gauge-temp');

            var m = state.memory || {};
            var totalMem = m.total || m.Total || 0;
            var usedMem = m.used || m.Used || 0;
            var memPctVal = totalMem > 0 ? Math.max(0, Math.min(100, Math.round((usedMem / totalMem) * 100))) : 0;
            var usedMB = (usedMem / (1024 * 1024)).toFixed(1);
            var totalMB = (totalMem / (1024 * 1024)).toFixed(1);
            liveHtml += '<div class="hpp-gauge">' +
                '<div class="hpp-gauge-head">' +
                    '<span class="hpp-gauge-label">RAM</span>' +
                    '<span class="hpp-gauge-value">' + usedMB + ' / ' + totalMB + ' MB</span>' +
                '</div>' +
                '<div class="hpp-gauge-track hpp-gauge-mem">' +
                    '<div class="hpp-gauge-marker" style="left:' + memPctVal + '%"></div>' +
                '</div>' +
                '<div class="hpp-gauge-scale">' +
                    '<span>0</span><span>' + (totalMB * 0.33).toFixed(0) + '</span><span>' + (totalMB * 0.66).toFixed(0) + '</span><span>' + totalMB + '</span>' +
                '</div>' +
            '</div>';

            liveHtml += '</div>';
        }
        if (state.title && !isDashboard(state.title)) {
            var ti = state.title;
            var currentTid = ti.titleid || ti.TitleId || '';
            var matchedGame = findGameByTitleId(currentTid);
            var npName = matchedGame ? getGameName(matchedGame) : (ti.Name || ti.name || '');
            if (npName) {
                liveHtml += '<div class="hpp-live-row">' +
                    '<span class="hpp-live-label">Now Playing</span>' +
                    '<span class="hpp-live-val" style="color:var(--success)">' + escapeHtml(npName) + '</span>' +
                '</div>';
            }
        }

        var headerBtnsHtml = '<div class="hpp-header-btns">' +
            '<button class="hpp-ctrl-btn hpp-profile-btn hpp-ctrl-labeled" id="hpp-go-profile" title="' + I18n.t('nav_profile') + '">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>' +
                '<span class="hpp-ctrl-label">' + I18n.t('nav_profile') + '</span>' +
            '</button>' +
            '<button class="hpp-ctrl-btn hpp-logout" id="hpp-logout-btn" title="' + I18n.t('cms_logout') + '">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>' +
            '</button>' +
        '</div>';

        var overlay = document.createElement('div');
        overlay.id = 'home-popup-overlay';
        overlay.className = 'home-popup-overlay';
        document.body.appendChild(overlay);

        var popup = document.createElement('div');
        popup.id = 'home-profile-popup';
        popup.className = 'home-profile-popup';
        popup.innerHTML = '<div class="hpp-header">' +
                '<div class="hpp-avatar-wrap">' + avatarHtml + '</div>' +
                '<div class="hpp-info">' +
                    '<div class="hpp-name">' + escapeHtml(cp.display_name || cp.username) + ' ' + levelBadge + '</div>' +
                    '<div class="hpp-email">' + escapeHtml(cp.email || '') + '</div>' +
                '</div>' +
                headerBtnsHtml +
            '</div>' +
            statsHtml +
            (liveHtml ? '<div class="hpp-live">' + liveHtml + '</div>' : '');
        document.body.appendChild(popup);

        function closePopup() {
            popup.remove();
            overlay.remove();
            document.removeEventListener('click', outsideClick);
        }
        function outsideClick(e) {
            if (!popup.contains(e.target) && e.target !== $('#hb-avatar-btn')) closePopup();
        }
        overlay.addEventListener('click', closePopup);
        setTimeout(function() { document.addEventListener('click', outsideClick); }, 10);

        var logoutBtn = popup.querySelector('#hpp-logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', function() {
                closePopup();
                NovaAPI.cmsUpdateOnlineStatus(false, null);
                NovaAPI.cmsLogout();
                state.cmsProfile = null;
                state.cmsStats = null;
                state.cmsNotifications = null;
                state.cmsRecentAchievements = null;
                renderHome();
            });
        }

        var goProfileBtn = popup.querySelector('#hpp-go-profile');
        if (goProfileBtn) {
            goProfileBtn.addEventListener('click', function() {
                closePopup();
                navigateTo('profile');
            });
        }
    }

    function showHomeLoginPopup(savedValues) {
        var existing = $('#home-profile-popup');
        if (existing) { existing.remove(); var ov = $('#home-popup-overlay'); if (ov) ov.remove(); return; }

        var overlay = document.createElement('div');
        overlay.id = 'home-popup-overlay';
        overlay.className = 'home-popup-overlay';
        document.body.appendChild(overlay);

        var popup = document.createElement('div');
        popup.id = 'home-profile-popup';
        popup.className = 'home-profile-popup home-login-popup';
        popup.innerHTML = '<div class="hlp-header">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="28" height="28"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>' +
                '<div class="hlp-title">' + I18n.t('cms_login_title') + '</div>' +
            '</div>' +
            '<form id="cms-login-form" class="hlp-form">' +
                '<input type="text" id="cms-login-email" class="hlp-input" placeholder="Email ou username" autocomplete="email" autocapitalize="off">' +
                '<input type="password" id="cms-login-password" class="hlp-input" placeholder="' + I18n.t('cms_login_pass') + '" autocomplete="current-password">' +
                '<p id="cms-login-error" class="cms-login-error hidden"></p>' +
                '<button type="submit" class="btn btn-primary btn-block" id="cms-login-btn">' +
                    '<span id="cms-login-btn-text">' + I18n.t('cms_login_btn') + '</span>' +
                    '<div id="cms-login-spinner" class="loader-spinner small hidden"></div>' +
                '</button>' +
            '</form>' +
            '<div class="hlp-signup">' +
                '<a href="https://speedygamesdownloads.com/register" target="_blank" rel="noopener">' + I18n.t('home_create_account') + '</a>' +
            '</div>';
        document.body.appendChild(popup);

        if (savedValues) {
            var emailInput = popup.querySelector('#cms-login-email');
            var passInput = popup.querySelector('#cms-login-password');
            if (emailInput && savedValues.email) emailInput.value = savedValues.email;
            if (passInput && savedValues.password) passInput.value = savedValues.password;
        }

        function closePopup() {
            popup.remove();
            overlay.remove();
        }
        overlay.addEventListener('click', closePopup);

        bindCmsLogin(closePopup);
    }

    var _homeSearchDocClickBound = false;
    function bindHomeSearch() {
        var input = $('#hb-search-input');
        var resultsDiv = $('#hb-search-results');
        if (!input || !resultsDiv) return;

        input.addEventListener('input', function() {
            var q = input.value.trim().toLowerCase();
            if (_homeSearchDebounce) clearTimeout(_homeSearchDebounce);
            if (q.length < 2) { resultsDiv.classList.add('hidden'); resultsDiv.innerHTML = ''; return; }
            _homeSearchDebounce = setTimeout(function() { performHomeSearch(q, resultsDiv); }, 250);
        });

        input.addEventListener('focus', function() {
            var q = input.value.trim().toLowerCase();
            if (q.length >= 2 && resultsDiv.innerHTML) resultsDiv.classList.remove('hidden');
        });

        if (!_homeSearchDocClickBound) {
            _homeSearchDocClickBound = true;
            document.addEventListener('click', function(e) {
                var inp = $('#hb-search-input');
                var res = $('#hb-search-results');
                if (inp && res && !inp.contains(e.target) && !res.contains(e.target)) {
                    res.classList.add('hidden');
                }
            });
        }
    }

    function performHomeSearch(q, resultsDiv) {
        var html = '';
        var matchCount = 0;

        var matchedGames = state.games.filter(function(g) {
            return getGameName(g).toLowerCase().indexOf(q) !== -1;
        }).slice(0, 5);

        if (matchedGames.length > 0) {
            html += '<div class="hsr-group-title">' + I18n.t('nav_games') + '</div>';
            matchedGames.forEach(function(g) {
                var imgUrl = getGameArt(g) || '';
                matchCount++;
                html += renderSearchGameItem(g, imgUrl);
            });
        }

        var localBlogHtml = renderSearchBlogResults(q, state._heroBlogPosts || []);
        if (localBlogHtml.count > 0) { html += localBlogHtml.html; matchCount += localBlogHtml.count; }

        var localEventHtml = renderSearchEventResults(q, state._heroEvents || []);
        if (localEventHtml.count > 0) { html += localEventHtml.html; matchCount += localEventHtml.count; }

        if (matchCount === 0) {
            html = '<div class="hsr-empty">' + I18n.t('games_empty') + '</div>';
        }
        resultsDiv.innerHTML = html;
        resultsDiv.classList.remove('hidden');
        bindSearchResultClicks(resultsDiv);

        if (state.isOnline) {
            NovaAPI.getBlogPosts(function(err, data) {
                if (!err && data && data.posts) {
                    state._allBlogPosts = data.posts;
                    refreshSearchCmsResults(q, resultsDiv);
                }
            });
            NovaAPI.getEvents(function(err, data) {
                if (!err && data && data.events) {
                    state._allEvents = data.events;
                    refreshSearchCmsResults(q, resultsDiv);
                }
            });
        }
    }

    function renderSearchGameItem(g, imgUrl) {
        return '<div class="hsr-item" data-type="game" data-id="' + escapeHtml(getGameId(g)) + '">' +
            '<img class="hsr-thumb" src="' + (imgUrl || 'img/noboxart.svg') + '" alt="" onerror="this.src=\'img/noboxart.svg\'">' +
            '<div class="hsr-info"><div class="hsr-name">' + escapeHtml(getGameName(g)) + '</div><div class="hsr-meta">' + gameTypeLabel(getGameType(g)) + '</div></div>' +
        '</div>';
    }

    function renderSearchBlogResults(q, posts) {
        var matched = posts.filter(function(p) {
            return (p.title || '').toLowerCase().indexOf(q) !== -1 ||
                   (p.content || '').replace(/<[^>]*>/g, '').toLowerCase().indexOf(q) !== -1;
        }).slice(0, 3);
        if (matched.length === 0) return { html: '', count: 0 };
        var html = '<div class="hsr-group-title">' + I18n.t('nav_news') + '</div>';
        matched.forEach(function(p) {
            html += '<div class="hsr-item" data-type="blog" data-id="' + p.id + '">' +
                '<div class="hsr-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>' +
                '<div class="hsr-info"><div class="hsr-name">' + escapeHtml(p.title) + '</div><div class="hsr-meta">Blog</div></div>' +
            '</div>';
        });
        return { html: html, count: matched.length };
    }

    function renderSearchEventResults(q, events) {
        var matched = events.filter(function(ev) {
            return (ev.title || '').toLowerCase().indexOf(q) !== -1 ||
                   (ev.description || '').toLowerCase().indexOf(q) !== -1;
        }).slice(0, 3);
        if (matched.length === 0) return { html: '', count: 0 };
        var html = '<div class="hsr-group-title">' + I18n.t('nav_events') + '</div>';
        matched.forEach(function(ev) {
            html += '<div class="hsr-item" data-type="event" data-id="' + ev.id + '" data-event-url="' + escapeHtml(ev.url || '') + '">' +
                '<div class="hsr-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></div>' +
                '<div class="hsr-info"><div class="hsr-name">' + escapeHtml(ev.title) + '</div><div class="hsr-meta">' + I18n.t('nav_events') + '</div></div>' +
            '</div>';
        });
        return { html: html, count: matched.length };
    }

    function refreshSearchCmsResults(q, resultsDiv) {
        var input = $('#hb-search-input');
        if (!input || input.value.trim().toLowerCase() !== q) return;
        var html = '';
        var matchCount = 0;

        var matchedGames = state.games.filter(function(g) {
            return getGameName(g).toLowerCase().indexOf(q) !== -1;
        }).slice(0, 5);
        if (matchedGames.length > 0) {
            html += '<div class="hsr-group-title">' + I18n.t('nav_games') + '</div>';
            matchedGames.forEach(function(g) { html += renderSearchGameItem(g, getGameArt(g) || ''); });
            matchCount += matchedGames.length;
        }

        var blogResult = renderSearchBlogResults(q, state._allBlogPosts || state._heroBlogPosts || []);
        if (blogResult.count > 0) { html += blogResult.html; matchCount += blogResult.count; }

        var eventResult = renderSearchEventResults(q, state._allEvents || state._heroEvents || []);
        if (eventResult.count > 0) { html += eventResult.html; matchCount += eventResult.count; }

        if (matchCount === 0) {
            html = '<div class="hsr-empty">' + I18n.t('games_empty') + '</div>';
        }
        resultsDiv.innerHTML = html;
        resultsDiv.classList.remove('hidden');
        bindSearchResultClicks(resultsDiv);
    }

    function bindSearchResultClicks(resultsDiv) {
        resultsDiv.querySelectorAll('.hsr-item').forEach(function(item) {
            item.addEventListener('click', function() {
                var type = this.getAttribute('data-type');
                var id = this.getAttribute('data-id');
                resultsDiv.classList.add('hidden');
                var input = $('#hb-search-input');
                if (input) input.value = '';
                if (type === 'game') {
                    navigateTo('games');
                    setTimeout(function() { showGameDetail(id); }, 100);
                } else if (type === 'blog') {
                    var allPosts = state._allBlogPosts || state._heroBlogPosts || [];
                    var post = allPosts.find(function(p) { return String(p.id) === id; });
                    if (post) showBlogPostDetail(post);
                } else if (type === 'event') {
                    var allEvents = state._allEvents || state._heroEvents || [];
                    var ev = allEvents.find(function(e) { return String(e.id) === id; });
                    if (ev) {
                        showEventDetail(ev, 'home');
                    } else {
                        navigateTo('events');
                    }
                }
            });
        });
    }

    function showConfirmDialog(message, onConfirm) {
        var overlay = document.createElement('div');
        overlay.className = 'fm-dialog-overlay';
        overlay.innerHTML = '<div class="fm-dialog">' +
            '<div class="fm-dialog-title">' + escapeHtml(message) + '</div>' +
            '<div class="fm-dialog-actions">' +
                '<button class="btn" id="confirm-dialog-cancel" style="background:var(--bg-secondary);color:var(--text-primary);border:1px solid var(--border)">' + I18n.t('cancel') + '</button>' +
                '<button class="btn" id="confirm-dialog-ok" style="background:var(--accent);color:#fff;border:none">' + I18n.t('confirm') + '</button>' +
            '</div>' +
        '</div>';
        document.body.appendChild(overlay);
        overlay.querySelector('#confirm-dialog-cancel').addEventListener('click', function() { overlay.remove(); });
        overlay.querySelector('#confirm-dialog-ok').addEventListener('click', function() { overlay.remove(); onConfirm(); });
    }

    function showXbdmWarning() {
        showConfirmDialog(I18n.t('home_xbdm_not_connected'), function() {});
    }

    function xbdmActionBtn(btn, command, successMsg, callback) {
        if (!state.xbdmBridgeConnected) {
            showXbdmWarning();
            return;
        }
        btn.disabled = true;
        btn.style.opacity = '0.5';
        NovaAPI.xbdmCommand(command, function(err) {
            if (err) {
                btn.style.background = 'var(--danger)';
                setTimeout(function() { btn.disabled = false; btn.style.opacity = ''; btn.style.background = ''; }, 2000);
            } else {
                btn.style.background = 'var(--success)';
                if (successMsg) btn.title = successMsg;
                setTimeout(function() { btn.disabled = false; btn.style.opacity = ''; btn.style.background = ''; btn.title = ''; }, 2000);
                if (callback) callback();
            }
        });
    }

    function bindHomeControlsRow() {
        var restartAuroraBtn = $('#hcr-restart-aurora');
        if (restartAuroraBtn) {
            restartAuroraBtn.addEventListener('click', function() {
                if (!state.xbdmBridgeConnected) {
                    showXbdmWarning();
                    return;
                }
                restartAuroraBtn.disabled = true;
                restartAuroraBtn.style.opacity = '0.5';
                NovaAPI.getPluginInfo(function(err, data) {
                    if (err || !data || !data.path || !data.path.launcher) {
                        restartAuroraBtn.style.background = 'var(--danger)';
                        setTimeout(function() { restartAuroraBtn.disabled = false; restartAuroraBtn.style.opacity = ''; restartAuroraBtn.style.background = ''; }, 2000);
                        return;
                    }
                    var fullPath = data.path.launcher;
                    var lastSlash = fullPath.lastIndexOf('\\');
                    var dir = lastSlash !== -1 ? fullPath.substring(0, lastSlash) : fullPath;
                    var exec = lastSlash !== -1 ? fullPath.substring(lastSlash + 1) : 'default.xex';
                    NovaAPI.launchTitle({ directory: dir, executable: exec, type: 0 }, function(launchErr) {
                        restartAuroraBtn.style.background = launchErr ? 'var(--danger)' : 'var(--success)';
                        setTimeout(function() { restartAuroraBtn.disabled = false; restartAuroraBtn.style.opacity = ''; restartAuroraBtn.style.background = ''; }, 3000);
                    });
                });
            });
        }

        var ejectBtn = $('#hcr-eject');
        if (ejectBtn) {
            ejectBtn.addEventListener('click', function() {
                if (!state.xbdmBridgeConnected) {
                    showXbdmWarning();
                    return;
                }
                var command = state.xbdmTrayOpen ? 'dvdeject eject=0' : 'dvdeject';
                xbdmActionBtn(ejectBtn, command, '', function() {
                    state.xbdmTrayOpen = !state.xbdmTrayOpen;
                    var labelEl = $('#hcr-eject-label');
                    var iconEl = $('#hcr-eject-icon');
                    if (labelEl) labelEl.textContent = state.xbdmTrayOpen ? I18n.t('home_inject') : I18n.t('home_eject');
                    if (iconEl) {
                        iconEl.innerHTML = state.xbdmTrayOpen
                            ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M12 22L2 10h20L12 22z"/><rect x="2" y="4" width="20" height="3" rx="1"/></svg>'
                            : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M12 2L2 14h20L12 2z"/><rect x="2" y="17" width="20" height="3" rx="1"/></svg>';
                    }
                    ejectBtn.title = state.xbdmTrayOpen ? I18n.t('home_inject') : I18n.t('home_eject');
                });
            });
        }

        var restartGameBtn = $('#hcr-restart-game');
        if (restartGameBtn) {
            restartGameBtn.addEventListener('click', function() {
                if (!state.xbdmBridgeConnected) {
                    showXbdmWarning();
                    return;
                }
                if (!state.title || isDashboard(state.title)) {
                    restartGameBtn.style.background = 'var(--danger)';
                    restartGameBtn.title = I18n.t('home_no_game_running');
                    setTimeout(function() { restartGameBtn.style.background = ''; restartGameBtn.title = I18n.t('home_restart_game'); }, 2000);
                    return;
                }
                showConfirmDialog(I18n.t('home_confirm_restart_game'), function() {
                    restartGameBtn.disabled = true;
                    restartGameBtn.style.opacity = '0.5';
                    var ti = state.title;
                    var currentTid = ti.titleid || ti.TitleId || '';
                    var matchedGame = findGameByTitleId(currentTid);
                    if (matchedGame && matchedGame.directory && matchedGame.executable) {
                        NovaAPI.launchTitle(matchedGame, function(err) {
                            restartGameBtn.style.background = err ? 'var(--danger)' : 'var(--success)';
                            setTimeout(function() { restartGameBtn.disabled = false; restartGameBtn.style.opacity = ''; restartGameBtn.style.background = ''; }, 3000);
                        });
                    } else {
                        NovaAPI.xbdmCommand('magicboot title=' + currentTid + ' cold', function(err) {
                            restartGameBtn.style.background = err ? 'var(--danger)' : 'var(--success)';
                            setTimeout(function() { restartGameBtn.disabled = false; restartGameBtn.style.opacity = ''; restartGameBtn.style.background = ''; }, 3000);
                        });
                    }
                });
            });
        }

        var restartConsoleBtn = $('#hcr-restart-console');
        if (restartConsoleBtn) {
            restartConsoleBtn.addEventListener('click', function() {
                if (!state.xbdmBridgeConnected) {
                    showXbdmWarning();
                    return;
                }
                showConfirmDialog(I18n.t('home_confirm_restart_console'), function() {
                    xbdmActionBtn(restartConsoleBtn, 'magicboot warm', I18n.t('home_console_restarting'));
                });
            });
        }

        var fanSpeedBtn = $('#hcr-fan-speed');
        if (fanSpeedBtn) {
            fanSpeedBtn.addEventListener('click', function() {
                showFanSpeedPopup();
            });
        }

        var moreBtns = document.querySelectorAll('.home-section-more[data-nav]');
        moreBtns.forEach(function(btn) {
            btn.addEventListener('click', function() {
                navigateTo(this.getAttribute('data-nav'));
            });
        });

        var controlsRow = $('#home-controls-row');
        var dotsContainer = $('#home-controls-dots');
        if (controlsRow && dotsContainer) {
            var updateControlsDots = function() {
                var sw = controlsRow.scrollWidth;
                var cw = controlsRow.clientWidth;
                if (sw <= cw + 2) {
                    dotsContainer.innerHTML = '';
                    return;
                }
                var btns = controlsRow.querySelectorAll('.home-cat-btn');
                var totalPages = Math.max(2, Math.ceil(btns.length / Math.max(1, Math.floor(cw / (btns[0] ? btns[0].offsetWidth + 8 : 80)))));
                var maxScroll = sw - cw;
                var progress = maxScroll > 0 ? controlsRow.scrollLeft / maxScroll : 0;
                var currentPage = Math.round(progress * (totalPages - 1));
                currentPage = Math.max(0, Math.min(currentPage, totalPages - 1));
                var dotsHtml = '';
                for (var i = 0; i < totalPages; i++) {
                    dotsHtml += '<span class="hc-dot' + (i === currentPage ? ' active' : '') + '"></span>';
                }
                dotsContainer.innerHTML = dotsHtml;
            };
            updateControlsDots();
            controlsRow.addEventListener('scroll', updateControlsDots);
            window.addEventListener('resize', updateControlsDots);
        }
    }

    function showFanSpeedPopup() {
        var fanSteps = [0, 44, 50, 60, 80, 90, 100];
        var fanFileNames = { 0: '00', 44: '44', 50: '50', 60: '60', 80: '80', 90: '90', 100: '100' };
        var selectedSpeed = 50;
        var isAuto = false;
        var countdownTimer = null;

        var overlay = document.createElement('div');
        overlay.className = 'fm-dialog-overlay';
        overlay.id = 'fan-speed-overlay';

        var stepsHtml = '';
        for (var i = 0; i < fanSteps.length; i++) {
            stepsHtml += '<span class="fan-step-label" data-step-idx="' + i + '">' + fanSteps[i] + '%</span>';
        }

        function buildCircularGauge(pct) {
            var r = 54;
            var circ = 2 * Math.PI * r;
            var gapDeg = 60;
            var arcLen = circ * (1 - gapDeg / 360);
            var filled = arcLen * (pct / 100);
            var startAngle = 90 + gapDeg / 2;
            return '<div class="fan-gauge-wrap">' +
                '<svg class="fan-gauge-svg" viewBox="0 0 128 128" width="140" height="140">' +
                    '<defs>' +
                        '<linearGradient id="fanGaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">' +
                            '<stop offset="0%" stop-color="#3b82f6"/>' +
                            '<stop offset="33%" stop-color="#10b981"/>' +
                            '<stop offset="66%" stop-color="#f59e0b"/>' +
                            '<stop offset="100%" stop-color="#ef4444"/>' +
                        '</linearGradient>' +
                    '</defs>' +
                    '<circle cx="64" cy="64" r="' + r + '" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="8" stroke-dasharray="' + arcLen + ' ' + (circ - arcLen) + '" stroke-dashoffset="0" stroke-linecap="round" transform="rotate(' + startAngle + ' 64 64)"/>' +
                    '<circle cx="64" cy="64" r="' + r + '" fill="none" stroke="url(#fanGaugeGrad)" stroke-width="8" stroke-dasharray="' + filled + ' ' + (circ - filled) + '" stroke-dashoffset="0" stroke-linecap="round" transform="rotate(' + startAngle + ' 64 64)" class="fan-gauge-fill"/>' +
                '</svg>' +
                '<div class="fan-gauge-center">' +
                    '<svg class="fan-gauge-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="18" height="18"><path d="M12 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0"/><path d="M12 2c0 4-2 6-2 10s2 6 2 10"/><path d="M12 2c0 4 2 6 2 10s-2 6-2 10"/><path d="M2 12c4 0 6-2 10-2s6 2 10 2"/><path d="M2 12c4 0 6 2 10 2s6-2 10-2"/></svg>' +
                    '<span class="fan-gauge-pct" id="fan-gauge-pct">' + pct + '</span>' +
                    '<span class="fan-gauge-unit">%</span>' +
                '</div>' +
            '</div>';
        }

        overlay.innerHTML = '<div class="fm-dialog fan-speed-dialog">' +
            '<div class="fm-dialog-title">' + I18n.t('home_fan_speed') + '</div>' +
            '<div class="fan-speed-body">' +
                buildCircularGauge(50) +
                '<div class="fan-slider-wrap">' +
                    '<input type="range" id="fan-speed-slider" min="0" max="' + (fanSteps.length - 1) + '" value="2" step="1" class="fan-speed-range">' +
                    '<div class="fan-step-labels">' + stepsHtml + '</div>' +
                '</div>' +
                '<button class="btn fan-auto-btn" id="fan-auto-btn">' + I18n.t('home_fan_auto') + '</button>' +
            '</div>' +
            '<div class="fan-zero-warning" id="fan-zero-warning" style="display:none">' +
                '<p class="fan-zero-text">' + I18n.t('home_fan_zero_warning') + '</p>' +
                '<div class="fan-zero-confirm-wrap">' +
                    '<input type="text" id="fan-zero-input" class="fan-zero-input" placeholder="' + I18n.t('home_fan_zero_placeholder') + '">' +
                '</div>' +
            '</div>' +
            '<div class="fan-speed-result" id="fan-speed-result" style="display:none"></div>' +
            '<div class="fm-dialog-actions" id="fan-speed-actions">' +
                '<button class="btn" id="fan-speed-cancel" style="background:var(--bg-secondary);color:var(--text-primary);border:1px solid var(--border)">' + I18n.t('cancel') + '</button>' +
                '<button class="btn" id="fan-speed-set" style="background:var(--accent);color:#fff;border:none">' + I18n.t('home_fan_set') + '</button>' +
            '</div>' +
        '</div>';

        document.body.appendChild(overlay);

        var slider = overlay.querySelector('#fan-speed-slider');
        var autoBtn = overlay.querySelector('#fan-auto-btn');
        var gaugePct = overlay.querySelector('#fan-gauge-pct');
        var gaugeFill = overlay.querySelector('.fan-gauge-fill');
        var gaugeCenter = overlay.querySelector('.fan-gauge-center');
        var zeroWarning = overlay.querySelector('#fan-zero-warning');

        var r = 54;
        var circ = 2 * Math.PI * r;
        var gapDeg = 60;
        var arcLen = circ * (1 - gapDeg / 360);

        function updateSliderUI() {
            if (isAuto) {
                gaugePct.textContent = I18n.t('home_fan_auto');
                gaugeCenter.querySelector('.fan-gauge-unit').style.display = 'none';
                gaugePct.style.fontSize = '18px';
                autoBtn.classList.add('fan-auto-active');
                slider.disabled = true;
                slider.style.opacity = '0.4';
                var filled = arcLen;
                gaugeFill.setAttribute('stroke-dasharray', filled + ' ' + (circ - filled));
                if (zeroWarning) zeroWarning.style.display = 'none';
            } else {
                var spd = fanSteps[parseInt(slider.value)];
                gaugePct.textContent = spd;
                gaugeCenter.querySelector('.fan-gauge-unit').style.display = '';
                gaugePct.style.fontSize = '';
                autoBtn.classList.remove('fan-auto-active');
                slider.disabled = false;
                slider.style.opacity = '';
                var filled = arcLen * (spd / 100);
                gaugeFill.setAttribute('stroke-dasharray', filled + ' ' + (circ - filled));
                if (zeroWarning) {
                    zeroWarning.style.display = spd === 0 ? 'block' : 'none';
                }
            }
        }

        slider.addEventListener('input', function() {
            isAuto = false;
            selectedSpeed = fanSteps[parseInt(slider.value)];
            updateSliderUI();
        });

        autoBtn.addEventListener('click', function() {
            isAuto = !isAuto;
            if (!isAuto) {
                selectedSpeed = fanSteps[parseInt(slider.value)];
            }
            updateSliderUI();
        });

        overlay.querySelector('#fan-speed-cancel').addEventListener('click', function() {
            if (countdownTimer) clearInterval(countdownTimer);
            overlay.remove();
        });

        overlay.querySelector('#fan-speed-set').addEventListener('click', function() {
            if (!isAuto && selectedSpeed === 0) {
                var confirmInput = overlay.querySelector('#fan-zero-input');
                if (confirmInput) {
                    var val = confirmInput.value.trim().toLowerCase();
                    var expected = I18n.t('home_fan_zero_confirm_word').toLowerCase();
                    if (val !== expected) {
                        confirmInput.style.borderColor = 'var(--danger)';
                        confirmInput.focus();
                        return;
                    }
                }
            }

            if (!confirm(I18n.t('home_fan_confirm_restart'))) {
                return;
            }

            var fileName = isAuto ? 'Auto' : (fanFileNames[selectedSpeed] || String(selectedSpeed));
            var speedLabel = isAuto ? I18n.t('home_fan_auto') : fileName + '%';

            var setBtn = overlay.querySelector('#fan-speed-set');
            setBtn.disabled = true;
            setBtn.textContent = I18n.t('loading');

            {
                var fanExec = fileName + '.xex';

                NovaAPI.getPluginInfo(function(piErr, piData) {
                    var fanPath = 'nova-webui\\fan-speed';
                    if (!piErr && piData && piData.path) {
                        var webPath = piData.path.web || piData.path.root || '';
                        if (webPath) {
                            if (webPath.charAt(webPath.length - 1) !== '\\') webPath += '\\';
                            fanPath = webPath + 'fan-speed';
                        }
                    }

                    NovaAPI.launchTitle({ directory: fanPath, executable: fanExec, type: 0 }, function(err) {
                        if (err) {
                            setBtn.textContent = I18n.t('error');
                            setBtn.style.background = 'var(--danger)';
                            setTimeout(function() {
                                setBtn.disabled = false;
                                setBtn.textContent = I18n.t('home_fan_set');
                                setBtn.style.background = 'var(--accent)';
                            }, 2000);
                            return;
                        }

                        var actionsDiv = overlay.querySelector('#fan-speed-actions');
                        var resultDiv = overlay.querySelector('#fan-speed-result');
                        actionsDiv.style.display = 'none';
                        if (zeroWarning) zeroWarning.style.display = 'none';

                        resultDiv.style.display = 'block';

                        var countdown = 10;
                        resultDiv.innerHTML = '<div class="fan-result-msg">' +
                            '<svg viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2" width="24" height="24"><path d="M20 6L9 17l-5-5"/></svg>' +
                            '<span>' + I18n.t('home_fan_set_success', { speed: speedLabel }) + '</span>' +
                        '</div>' +
                        '<p class="fan-restart-hint">' + I18n.t('home_fan_restart_msg') + '</p>' +
                        '<button class="btn fan-restart-btn" id="fan-restart-console" style="background:var(--accent);color:#fff;border:none;width:100%;padding:12px">' +
                            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16" style="vertical-align:middle;margin-right:6px"><path d="M18.36 6.64A9 9 0 1 1 5.64 6.64"/><line x1="12" y1="2" x2="12" y2="12"/></svg>' +
                            I18n.t('home_fan_countdown', { seconds: countdown }) +
                        '</button>';

                        var restartBtn = overlay.querySelector('#fan-restart-console');

                        countdownTimer = setInterval(function() {
                            countdown--;
                            if (countdown <= 0) {
                                clearInterval(countdownTimer);
                                countdownTimer = null;
                                overlay.remove();
                                NovaAPI.xbdmCommand('magicboot cold', function() {});
                                return;
                            }
                            if (restartBtn) {
                                restartBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16" style="vertical-align:middle;margin-right:6px"><path d="M18.36 6.64A9 9 0 1 1 5.64 6.64"/><line x1="12" y1="2" x2="12" y2="12"/></svg>' +
                                    I18n.t('home_fan_countdown', { seconds: countdown });
                            }
                        }, 1000);

                        restartBtn.addEventListener('click', function() {
                            if (countdownTimer) {
                                clearInterval(countdownTimer);
                                countdownTimer = null;
                            }
                            restartBtn.innerHTML = I18n.t('home_fan_countdown_cancelled');
                            restartBtn.disabled = true;
                            restartBtn.style.background = 'var(--bg-secondary)';
                            restartBtn.style.color = 'var(--text-secondary)';
                            restartBtn.style.border = '1px solid var(--border)';

                            var closeHtml = '<button class="btn" id="fan-close-btn" style="background:var(--bg-secondary);color:var(--text-primary);border:1px solid var(--border);width:100%;padding:10px;margin-top:8px">' + I18n.t('cancel') + '</button>';
                            restartBtn.insertAdjacentHTML('afterend', closeHtml);
                            overlay.querySelector('#fan-close-btn').addEventListener('click', function() {
                                overlay.remove();
                            });
                        });
                    });
                });
            }
        });
    }

    function loadHomeHeroSlider() {
        var track = $('#home-hero-track');
        var dotsContainer = $('#home-hero-dots');
        if (!track || !dotsContainer) return;

        state._heroBlogPosts = [];
        state._heroEvents = [];
        var pending = state.isOnline ? 2 : 0;
        var slides = [];

        function renderSlides() {
            if (slides.length === 0) {
                var slider = $('#home-hero-slider');
                if (slider) slider.style.display = 'none';
                return;
            }
            var html = '';
            slides.forEach(function(slide, i) {
                html += '<div class="hero-slide' + (i === 0 ? ' active' : '') + '" data-slide-type="' + slide.type + '" data-slide-id="' + slide.id + '" style="background-image:url(' + escapeHtml(slide.image) + ')">' +
                    '<div class="hero-slide-overlay"></div>' +
                    '<div class="hero-slide-content">' +
                        '<span class="hero-slide-badge">' + escapeHtml(slide.badge) + '</span>' +
                        '<div class="hero-slide-title">' + escapeHtml(slide.title) + '</div>' +
                        '<div class="hero-slide-desc">' + escapeHtml(slide.desc) + '</div>' +
                    '</div>' +
                '</div>';
            });
            track.innerHTML = html;

            var dotsHtml = '';
            slides.forEach(function(_, i) {
                dotsHtml += '<button class="hero-dot' + (i === 0 ? ' active' : '') + '" data-idx="' + i + '"></button>';
            });
            dotsContainer.innerHTML = dotsHtml;

            var currentIdx = 0;
            function goToSlide(idx) {
                var allSlides = track.querySelectorAll('.hero-slide');
                var allDots = dotsContainer.querySelectorAll('.hero-dot');
                allSlides.forEach(function(s, i) { s.classList.toggle('active', i === idx); });
                allDots.forEach(function(d, i) { d.classList.toggle('active', i === idx); });
                currentIdx = idx;
            }

            dotsContainer.querySelectorAll('.hero-dot').forEach(function(dot) {
                dot.addEventListener('click', function() {
                    goToSlide(parseInt(this.getAttribute('data-idx')));
                });
            });

            if (slides.length > 1) {
                _heroSliderInterval = setInterval(function() {
                    goToSlide((currentIdx + 1) % slides.length);
                }, 5000);
            }

            track.querySelectorAll('.hero-slide').forEach(function(slide) {
                slide.addEventListener('click', function() {
                    var type = this.getAttribute('data-slide-type');
                    var id = this.getAttribute('data-slide-id');
                    if (type === 'blog') {
                        var post = (state._heroBlogPosts || []).find(function(p) { return String(p.id) === id; });
                        if (post) showBlogPostDetail(post);
                    } else if (type === 'event') {
                        var ev = (state._heroEvents || []).find(function(e) { return String(e.id) === id; });
                        if (ev) {
                            showEventDetail(ev, 'home');
                        } else {
                            navigateTo('events');
                        }
                    }
                });
            });

            var startX = 0, startY = 0, isDragging = false;
            track.addEventListener('touchstart', function(e) {
                startX = e.touches[0].clientX;
                startY = e.touches[0].clientY;
                isDragging = true;
            }, { passive: true });
            track.addEventListener('touchend', function(e) {
                if (!isDragging) return;
                isDragging = false;
                var dx = e.changedTouches[0].clientX - startX;
                var dy = e.changedTouches[0].clientY - startY;
                if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) {
                    if (dx < 0) {
                        goToSlide((currentIdx + 1) % slides.length);
                    } else {
                        goToSlide((currentIdx - 1 + slides.length) % slides.length);
                    }
                }
            }, { passive: true });
        }

        if (!state.isOnline) { renderSlides(); return; }

        NovaAPI.getBlogPosts(function(err, data) {
            if (!err && data) {
                var posts = data.posts || [];
                state._heroBlogPosts = posts;
                posts.slice(0, 3).forEach(function(post) {
                    var excerpt = (post.content || '').replace(/<[^>]*>/g, '').substring(0, 100);
                    if ((post.content || '').length > 100) excerpt += '...';
                    slides.push({
                        type: 'blog',
                        id: String(post.id),
                        image: post.cover_image_url || 'img/noboxart.svg',
                        badge: I18n.t('nav_news'),
                        title: post.title || '',
                        desc: excerpt
                    });
                });
            }
            pending--;
            if (pending <= 0) renderSlides();
        });

        NovaAPI.getEvents(function(err, data) {
            if (!err && data) {
                var events = data.events || [];
                state._heroEvents = events;
                events.slice(0, 2).forEach(function(ev) {
                    var dateStr = '';
                    if (ev.event_date) {
                        try { dateStr = new Date(ev.event_date).toLocaleDateString('pt-BR'); } catch(e) {}
                    }
                    slides.push({
                        type: 'event',
                        id: String(ev.id),
                        image: ev.cover_image_url || 'img/noboxart.svg',
                        badge: I18n.t('nav_events'),
                        title: ev.title || '',
                        desc: dateStr + (ev.location ? ' - ' + ev.location : '')
                    });
                });
            }
            pending--;
            if (pending <= 0) renderSlides();
        });
    }

    function renderHomeGameCard(g, badge) {
        var imgUrl = getGameArt(g) || '';
        var imgAttr = imgUrl ? 'data-auth-src="' + escapeHtml(imgUrl) + '"' : 'src="img/noboxart.svg"';
        return '<div class="home-game-card" data-titleid="' + escapeHtml(getGameId(g)) + '">' +
            '<div class="home-game-card-img-wrap">' +
                '<img class="home-game-card-img" ' + imgAttr + ' alt="" loading="lazy" onerror="this.onerror=null;this.src=\'img/noboxart.svg\'">' +
                (badge || '') +
            '</div>' +
            '<div class="home-game-card-name">' + escapeHtml(getGameName(g)) + '</div>' +
            '<div class="home-game-card-type">' + gameTypeLabel(getGameType(g)) + '</div>' +
        '</div>';
    }

    function bindHomeGameCards(container) {
        container.querySelectorAll('.home-game-card').forEach(function(card) {
            card.addEventListener('click', function() {
                var tid = this.getAttribute('data-titleid');
                navigateTo('games');
                setTimeout(function() { showGameDetail(tid); }, 100);
            });
        });
        container.querySelectorAll('.home-game-card-img[data-auth-src]').forEach(function(img) {
            NovaAPI.loadAuthImageQueued(img.getAttribute('data-auth-src'), img);
        });
    }

    function loadHomeNews() {
        var section = $('#home-news-section');
        if (!section || !state.isOnline) return;

        NovaAPI.getBlogPosts(function(err, data) {
            if (err || !data || !section) return;
            var posts = (data.posts || []).slice(0, 5);
            if (posts.length === 0) { section.style.display = 'none'; return; }

            var html = '<div class="home-section-header">' +
                '<span class="home-section-title">' + I18n.t('home_news_section') + '</span>' +
                '<button class="home-section-more" data-nav="news">' + I18n.t('home_see_all') + '</button>' +
            '</div>';
            html += '<div class="home-hscroll">';
            posts.forEach(function(post) {
                var dateStr = '';
                if (post.published_at) {
                    try { dateStr = new Date(post.published_at).toLocaleDateString('pt-BR'); } catch(e) {}
                }
                var pinnedBadge = post.pinned ? '<span class="blog-pin-badge"><svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/></svg></span>' : '';
                var coverHtml = post.cover_image_url
                    ? '<div class="home-blog-card-cover"><img src="' + escapeHtml(post.cover_image_url) + '" alt="" onerror="this.parentElement.style.display=\'none\'"></div>'
                    : '<div class="home-blog-card-cover" style="background:var(--accent);display:flex;align-items:center;justify-content:center"><svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" width="32" height="32"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>';
                html += '<div class="home-blog-card" data-blog-id="' + post.id + '">' +
                    coverHtml +
                    '<div class="home-blog-card-body">' +
                        '<div class="home-blog-card-title">' + pinnedBadge + escapeHtml(post.title) + '</div>' +
                        '<div class="home-blog-card-date">' + escapeHtml(dateStr) + '</div>' +
                    '</div>' +
                '</div>';
            });
            html += '</div>';
            section.innerHTML = html;

            var moreBtn = section.querySelector('.home-section-more[data-nav]');
            if (moreBtn) {
                moreBtn.addEventListener('click', function() { navigateTo('news'); });
            }
            section.querySelectorAll('.home-blog-card').forEach(function(card) {
                card.addEventListener('click', function() {
                    var postId = parseInt(card.getAttribute('data-blog-id'));
                    var post = posts.find(function(p) { return p.id === postId; });
                    if (post) showBlogPostDetail(post, 'home');
                });
            });
        });
    }

    function loadHomeCmsGames() {
        var section = $('#home-cms-games-section');
        if (!section || !state.isOnline) return;

        NovaAPI.getCmsGames({ limit: 8, sort: 'latest' }, function(err, data) {
            if (err || !data || !data.games || data.games.length === 0) {
                if (section) section.style.display = 'none';
                return;
            }

            var consoleGamesMap = {};
            state.games.forEach(function(g) {
                var tid = getGameId(g);
                if (tid && g.directory && g.executable) consoleGamesMap[tid.toLowerCase()] = g;
            });

            var html = '<div class="home-section-header">' +
                '<span class="home-section-title">' + I18n.t('home_cms_games') + '</span>' +
                '<button class="home-section-more" data-nav="games">' + I18n.t('home_see_all') + '</button>' +
            '</div>';
            html += '<div class="home-hscroll-wrap">';
            html += '<div class="home-hscroll" id="home-cms-hscroll">';
            data.games.forEach(function(cg) {
                var coverSrc = cg.cover_image ? escapeHtml(cg.cover_image) : 'img/noboxart.svg';
                var installed = cg.title_id && consoleGamesMap[cg.title_id.toLowerCase()];
                html += '<div class="home-cms-game-card" data-titleid="' + escapeHtml(cg.title_id || '') + '" data-cms-id="' + cg.id + '">' +
                    '<div class="home-cms-game-card-img-wrap">' +
                        '<img src="' + coverSrc + '" alt="" loading="lazy" onerror="this.onerror=null;this.src=\'img/noboxart.svg\'">' +
                        (installed ? '<button class="home-cms-launch-btn" data-titleid="' + escapeHtml(cg.title_id) + '" title="' + I18n.t('games_launch') + '"><svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><polygon points="5,3 19,12 5,21"/></svg></button>' : '') +
                    '</div>' +
                    '<div class="home-cms-game-card-name">' + escapeHtml(cg.title) + '</div>' +
                    '<div class="home-cms-game-card-pub">' + escapeHtml(cg.publisher || cg.platform || '') + '</div>' +
                '</div>';
            });
            html += '</div>';
            html += '<div class="home-hscroll-dots" id="home-cms-dots"></div>';
            html += '</div>';
            section.innerHTML = html;

            var scrollEl = section.querySelector('#home-cms-hscroll');
            var dotsEl = section.querySelector('#home-cms-dots');
            if (scrollEl && dotsEl && data.games.length > 0) {
                var cardWidth = 152;
                var visibleCards = Math.max(1, Math.floor(scrollEl.clientWidth / cardWidth));
                var totalDots = Math.max(1, Math.ceil(data.games.length / visibleCards));
                if (totalDots > 1) {
                    var dotsHtml = '';
                    for (var di = 0; di < totalDots; di++) {
                        dotsHtml += '<span class="hscroll-dot' + (di === 0 ? ' active' : '') + '" data-dot="' + di + '"></span>';
                    }
                    dotsEl.innerHTML = dotsHtml;
                    scrollEl.addEventListener('scroll', function() {
                        var scrollPos = scrollEl.scrollLeft;
                        var activeDot = Math.round(scrollPos / (cardWidth * visibleCards));
                        activeDot = Math.min(activeDot, totalDots - 1);
                        dotsEl.querySelectorAll('.hscroll-dot').forEach(function(d, i) {
                            d.classList.toggle('active', i === activeDot);
                        });
                    });
                    dotsEl.querySelectorAll('.hscroll-dot').forEach(function(dot) {
                        dot.addEventListener('click', function() {
                            var idx = parseInt(dot.getAttribute('data-dot'));
                            scrollEl.scrollTo({ left: idx * cardWidth * visibleCards, behavior: 'smooth' });
                        });
                    });
                }
            }

            var moreBtn = section.querySelector('.home-section-more[data-nav]');
            if (moreBtn) {
                moreBtn.addEventListener('click', function() { navigateTo('games'); });
            }
            section.querySelectorAll('.home-cms-launch-btn').forEach(function(btn) {
                btn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    var tid = btn.getAttribute('data-titleid');
                    var g = tid ? consoleGamesMap[tid.toLowerCase()] : null;
                    if (g) NovaAPI.launchTitle(g);
                });
            });
            section.querySelectorAll('.home-cms-game-card').forEach(function(card) {
                card.addEventListener('click', function() {
                    var tid = card.getAttribute('data-titleid');
                    if (tid) {
                        navigateTo('games');
                        setTimeout(function() { showGameDetail(tid); }, 100);
                    } else {
                        navigateTo('games');
                    }
                });
            });
        });
    }

    function loadHomePopularGames() {
        var scroll = $('#home-popular-scroll');
        if (!scroll) return;

        if (state.isOnline) {
            NovaAPI.getPopularGames(function(err, data) {
                if (!err && data && data.games && data.games.length > 0) {
                    var popularTitleIds = {};
                    var downloadCounts = {};
                    data.games.forEach(function(pg) {
                        if (pg.title_id) {
                            popularTitleIds[pg.title_id] = true;
                            downloadCounts[pg.title_id] = parseInt(pg.download_count) || 0;
                        }
                    });
                    var popular = state.games.filter(function(g) {
                        return popularTitleIds[getGameId(g)];
                    });
                    popular.sort(function(a, b) {
                        return (downloadCounts[getGameId(b)] || 0) - (downloadCounts[getGameId(a)] || 0);
                    });
                    if (popular.length > 0) {
                        renderPopularInto(scroll, popular.slice(0, 12), downloadCounts);
                        return;
                    }
                }
                loadPopularFallback(scroll);
            });
        } else {
            loadPopularFallback(scroll);
        }
    }

    function loadPopularFallback(scroll) {
        if (isCmsLoggedIn() && state.cmsProfile) {
            NovaAPI.listFavorites(state.cmsProfile.id, function(err, data) {
                var popular = [];
                if (!err && data && data.favorites && data.favorites.length > 0) {
                    var favTitleIds = {};
                    data.favorites.forEach(function(f) {
                        if (f.title_id) favTitleIds[f.title_id] = true;
                    });
                    popular = state.games.filter(function(g) {
                        return favTitleIds[getGameId(g)];
                    }).slice(0, 12);
                }
                if (popular.length === 0) {
                    var section = $('#home-popular-games');
                    if (section) section.style.display = 'none';
                    return;
                }
                renderPopularInto(scroll, popular, null);
            });
        } else {
            var section = $('#home-popular-games');
            if (section) section.style.display = 'none';
        }
    }

    function renderPopularInto(scroll, games, downloadCounts) {
        if (games.length === 0) {
            var section = $('#home-popular-games');
            if (section) section.style.display = 'none';
            return;
        }
        var html = '';
        games.forEach(function(g, i) {
            var badge = '';
            if (downloadCounts && downloadCounts[getGameId(g)]) {
                badge = '<span class="hgc-dl-badge">' + downloadCounts[getGameId(g)] + ' DL</span>';
            } else if (i < 3) {
                badge = '<span class="hgc-rank-badge">#' + (i + 1) + '</span>';
            }
            html += renderHomeGameCard(g, badge);
        });
        scroll.innerHTML = html;
        bindHomeGameCards(scroll);
    }

    function loadHomeRoomInvites() {
        var container = $('#home-room-invites');
        if (!container || !state.cmsProfile || !state.cmsNotifications) return;
        var notifs = state.cmsNotifications.notifications || [];
        var invites = notifs.filter(function(n) { return n.type === 'room_invite' && !n.read; });
        if (invites.length === 0) { container.innerHTML = ''; return; }
        var html = '<div class="home-section home-room-invite-section">' +
            '<div class="home-section-header">' +
                '<span class="home-section-title">' + I18n.t('home_room_invites') + '</span>' +
            '</div>';
        invites.forEach(function(inv) {
            var roomName = '';
            if (inv.data && inv.data.room_title) roomName = inv.data.room_title;
            else if (inv.message) roomName = inv.message;
            else roomName = inv.title;
            var roomId = (inv.data && inv.data.room_id) ? inv.data.room_id : null;
            html += '<div class="home-room-invite-card" data-room-id="' + (roomId || '') + '" data-notif-id="' + inv.id + '">' +
                '<div class="home-room-invite-icon">' +
                    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>' +
                '</div>' +
                '<div class="home-room-invite-body">' +
                    '<div class="home-room-invite-title">' + escapeHtml(roomName) + '</div>' +
                    '<div class="home-room-invite-msg">' + escapeHtml(inv.title) + '</div>' +
                '</div>' +
                '<button class="home-room-invite-btn">' + I18n.t('home_room_invite_join') + '</button>' +
            '</div>';
        });
        html += '</div>';
        container.innerHTML = html;
        container.querySelectorAll('.home-room-invite-card').forEach(function(card) {
            card.addEventListener('click', function() {
                var roomId = card.getAttribute('data-room-id');
                var nid = parseInt(card.getAttribute('data-notif-id'));
                if (nid) {
                    NovaAPI.markNotificationRead(nid, function() {});
                    if (state.cmsNotifications && state.cmsNotifications.notifications) {
                        state.cmsNotifications.notifications = state.cmsNotifications.notifications.map(function(n) {
                            if (n.id === nid) n.read = true;
                            return n;
                        });
                        if (state.cmsNotifications.unread_count > 0) state.cmsNotifications.unread_count--;
                    }
                }
                card.remove();
                if (container.querySelectorAll('.home-room-invite-card').length === 0) {
                    container.innerHTML = '';
                }
                navigateTo('rooms');
                if (roomId) {
                    setTimeout(function() { loadRoomDetail(parseInt(roomId)); }, 200);
                }
            });
        });
    }

    function loadHomeEvents() {
        var section = $('#home-events-section');
        if (!section || !state.isOnline) return;

        NovaAPI.getEvents(function(err, data) {
            if (err || !data || !section) return;
            var events = data.events || [];
            if (events.length === 0) return;

            var html = '<div class="home-section-header">' +
                '<span class="home-section-title">' + I18n.t('nav_events') + '</span>' +
                '<button class="home-section-more" data-nav="events">' + I18n.t('home_see_all') + '</button>' +
            '</div>';
            html += '<div class="home-hscroll">';
            events.slice(0, 5).forEach(function(ev) {
                html += buildEventCardHtml(ev, true);
            });
            html += '</div>';
            section.innerHTML = html;
            bindEventCardHandlers(section, events);
            var moreBtn = section.querySelector('.home-section-more[data-nav]');
            if (moreBtn) {
                moreBtn.addEventListener('click', function() { navigateTo('events'); });
            }
        });
    }

    function renderNews() {
        var el = $('#page-news');
        if (!el) return;
        el.innerHTML = '<div class="page-header"><div><div class="page-title">' + I18n.t('news_title') + '</div></div></div>' +
            '<div id="news-list-section"><div class="loader-spinner" style="margin:24px auto"></div></div>';
        if (!state.isOnline) {
            el.querySelector('#news-list-section').innerHTML = '<p style="color:var(--text-muted);font-size:13px;text-align:center;padding:24px">' + I18n.t('home_connect_error') + '</p>';
            return;
        }
        NovaAPI.getBlogPosts(function(err, data) {
            var section = el.querySelector('#news-list-section');
            if (!section) return;
            if (err || !data) {
                section.innerHTML = '<p style="color:var(--text-muted);font-size:13px;text-align:center;padding:24px">' + I18n.t('news_error') + '</p>';
                return;
            }
            var posts = data.posts || [];
            if (posts.length === 0) {
                section.innerHTML = '<p style="color:var(--text-muted);font-size:13px;text-align:center;padding:24px">' + I18n.t('news_empty') + '</p>';
                return;
            }
            var html = '<div class="news-full-list">';
            posts.forEach(function(post) {
                var dateStr = '';
                if (post.published_at) {
                    try {
                        var d = new Date(post.published_at);
                        dateStr = d.toLocaleDateString('pt-BR');
                    } catch(e) {}
                }
                var excerpt = (post.content || '').replace(/<[^>]*>/g, '').substring(0, 200);
                if ((post.content || '').length > 200) excerpt += '...';
                var pinnedBadge = post.pinned ? '<span class="blog-pin-badge"><svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/></svg></span> ' : '';
                html += '<div class="blog-post-card card news-full-card" data-blog-id="' + post.id + '">';
                if (post.cover_image_url) {
                    html += '<div class="blog-post-cover"><img src="' + escapeHtml(post.cover_image_url) + '" alt="" onerror="this.parentElement.style.display=\'none\'"></div>';
                }
                var nViewCount = post.view_count || 0;
                html += '<div class="blog-post-body">' +
                    '<div class="blog-post-title">' + pinnedBadge + escapeHtml(post.title) + '</div>' +
                    '<div class="blog-post-date">' + escapeHtml(dateStr) + (post.author ? ' · ' + escapeHtml(typeof post.author === 'string' ? post.author : (post.author.display_name || post.author.username || '')) : '') +
                    ' · <span class="blog-view-count"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12" style="vertical-align:-1px"><path d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.64 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.64 0-8.573-3.007-9.963-7.178z"/><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg> ' + nViewCount + '</span>' +
                    '</div>' +
                    '<div class="blog-post-excerpt">' + escapeHtml(excerpt) + '</div>' +
                '</div></div>';
            });
            html += '</div>';
            section.innerHTML = html;
            section.querySelectorAll('.blog-post-card').forEach(function(card) {
                card.addEventListener('click', function() {
                    var postId = parseInt(card.getAttribute('data-blog-id'));
                    var post = posts.find(function(p) { return p.id === postId; });
                    if (post) showBlogPostDetail(post, 'news');
                });
            });
        });
    }

    function buildEventCardHtml(ev, includeRsvp) {
        var dateStr = '';
        if (ev.event_date) {
            try {
                var d = new Date(ev.event_date);
                dateStr = d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            } catch(e) {}
        }
        var typeLabels = { sorteio: 'Sorteio', live: 'Live', torneio: 'Torneio', outro: 'Outro' };
        var typeColors = { sorteio: '#a78bfa', live: '#ef4444', torneio: '#f59e0b', outro: '#8b8ba3' };
        var typeBadgeColor = typeColors[ev.event_type] || '#8b8ba3';
        var typeLabel = typeLabels[ev.event_type] || ev.event_type;
        var safeUrl = sanitizeUrl(ev.event_url);
        var linkAttr = safeUrl ? ' data-event-url="' + escapeHtml(safeUrl) + '"' : '';
        var viewCount = ev.view_count || 0;
        var rsvpCount = ev.rsvp_count || 0;
        var userHasRsvp = ev.user_has_rsvp || false;
        var html = '<div class="event-card card" data-event-id="' + ev.id + '"' + linkAttr + '>';
        if (ev.cover_image_url) {
            html += '<div class="event-cover"><img src="' + escapeHtml(ev.cover_image_url) + '" alt="" onerror="this.parentElement.style.display=\'none\'"></div>';
        }
        var countdownHtml = '';
        if (ev.event_date) {
            var evDate = new Date(ev.event_date);
            var nowMs = Date.now();
            var diffMs = evDate.getTime() - nowMs;
            if (diffMs > 0) {
                var diffDays = Math.floor(diffMs / 86400000);
                var diffHours = Math.floor((diffMs % 86400000) / 3600000);
                var diffMins = Math.floor((diffMs % 3600000) / 60000);
                var cdText = '';
                if (diffDays > 0) cdText = diffDays + 'd ' + diffHours + 'h';
                else if (diffHours > 0) cdText = diffHours + 'h ' + diffMins + 'm';
                else cdText = diffMins + 'm';
                countdownHtml = '<div class="event-countdown"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> ' + cdText + '</div>';
            }
        }
        var statsHtml = '<div class="event-stats">' +
            '<span class="event-stat-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12" style="vertical-align:-1px"><path d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.64 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.64 0-8.573-3.007-9.963-7.178z"/><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg> ' + viewCount + '</span>' +
            '<span class="event-stat-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12" style="vertical-align:-1px"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg> ' + rsvpCount + ' ' + (rsvpCount === 1 ? I18n.t('event_attendees_singular') : I18n.t('event_attendees')) + '</span>' +
        '</div>';
        var rsvpHtml = '';
        if (includeRsvp && isCmsLoggedIn()) {
            var rsvpBtnClass = userHasRsvp ? 'event-rsvp-btn confirmed' : 'event-rsvp-btn';
            var rsvpBtnText = userHasRsvp ? I18n.t('event_rsvp_leave') : I18n.t('event_rsvp_join');
            rsvpHtml = '<div class="event-rsvp-row">' +
                '<button class="' + rsvpBtnClass + '" data-rsvp-event="' + ev.id + '">' + rsvpBtnText + '</button>' +
                '<button class="event-attendees-btn" data-attendees-event="' + ev.id + '" title="' + I18n.t('event_rsvp_attendees_title') + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></button>' +
            '</div>';
        }
        html += '<div class="event-body">' +
            '<div class="event-header">' +
                '<span class="event-type-badge" style="background:' + typeBadgeColor + '">' + escapeHtml(typeLabel) + '</span>' +
                (dateStr ? '<span class="event-date">' + escapeHtml(dateStr) + '</span>' : '') +
            '</div>' +
            '<div class="event-title">' + escapeHtml(ev.title) + '</div>' +
            (ev.description ? '<div class="event-desc">' + escapeHtml(ev.description.substring(0, 200)) + (ev.description.length > 200 ? '...' : '') + '</div>' : '') +
            countdownHtml +
            statsHtml +
            rsvpHtml +
        '</div></div>';
        return html;
    }

    var _eventViewsSent = {};

    function bindEventCardHandlers(container, events, fromPage) {
        container.querySelectorAll('.event-card').forEach(function(card) {
            card.style.cursor = 'pointer';
            card.addEventListener('click', function(e) {
                if (e.target.closest('.event-rsvp-btn') || e.target.closest('.event-attendees-btn')) return;
                var evId = parseInt(card.getAttribute('data-event-id'));
                var ev = events.find(function(evt) { return evt.id === evId; });
                if (ev) showEventDetail(ev, fromPage || 'home');
            });
        });

        if (typeof IntersectionObserver !== 'undefined') {
            var observer = new IntersectionObserver(function(entries) {
                entries.forEach(function(entry) {
                    if (entry.isIntersecting) {
                        var card = entry.target;
                        var evId = parseInt(card.getAttribute('data-event-id'));
                        if (evId && !_eventViewsSent[evId]) {
                            _eventViewsSent[evId] = true;
                            NovaAPI.postEventView(evId, function() {});
                        }
                        observer.unobserve(card);
                    }
                });
            }, { threshold: 0.5 });
            container.querySelectorAll('.event-card[data-event-id]').forEach(function(card) {
                observer.observe(card);
            });
        }
        container.querySelectorAll('.event-rsvp-btn').forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                var eventId = parseInt(btn.getAttribute('data-rsvp-event'));
                btn.disabled = true;
                NovaAPI.postEventRsvp(eventId, function(err, resp) {
                    btn.disabled = false;
                    if (err) return;
                    if (resp && resp.success) {
                        var isJoined = resp.has_rsvp === true;
                        btn.className = isJoined ? 'event-rsvp-btn confirmed' : 'event-rsvp-btn';
                        btn.textContent = isJoined ? I18n.t('event_rsvp_leave') : I18n.t('event_rsvp_join');
                        var card = btn.closest('.event-card');
                        if (card) {
                            var statItem = card.querySelectorAll('.event-stat-item')[1];
                            if (statItem) {
                                var count = resp.rsvp_count || 0;
                                statItem.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12" style="vertical-align:-1px"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg> ' + count + ' ' + (count === 1 ? I18n.t('event_attendees_singular') : I18n.t('event_attendees'));
                            }
                        }
                    }
                });
            });
        });
        container.querySelectorAll('.event-attendees-btn').forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                var eventId = parseInt(btn.getAttribute('data-attendees-event'));
                NovaAPI.getEventRsvp(eventId, function(err, resp) {
                    if (err || !resp || !resp.success) return;
                    var attendees = resp.attendees || [];
                    showAttendeesModal(attendees);
                });
            });
        });
    }

    function showAttendeesModal(attendees) {
        var existing = $('#event-attendees-modal');
        if (existing) existing.remove();
        var modal = document.createElement('div');
        modal.id = 'event-attendees-modal';
        modal.className = 'modal-overlay';
        var html = '<div class="modal-content">' +
            '<div class="modal-header">' +
                '<h3>' + I18n.t('event_rsvp_attendees_title') + ' (' + attendees.length + ')</h3>' +
                '<button class="modal-close-btn" id="close-attendees-modal">&times;</button>' +
            '</div>' +
            '<div class="modal-body">';
        if (attendees.length === 0) {
            html += '<p style="color:var(--text-muted);text-align:center;padding:16px">' + I18n.t('event_no_attendees') + '</p>';
        } else {
            html += '<div class="attendees-list">';
            attendees.forEach(function(a) {
                html += '<div class="attendee-item">' +
                    '<div class="attendee-avatar">' +
                        (a.avatar_url ? '<img src="' + escapeHtml(a.avatar_url) + '" alt="" onerror="this.style.display=\'none\'">' : '<span>' + (a.display_name || '?').charAt(0).toUpperCase() + '</span>') +
                    '</div>' +
                    '<span class="attendee-name">' + escapeHtml(a.display_name || 'User') + '</span>' +
                '</div>';
            });
            html += '</div>';
        }
        html += '</div></div>';
        modal.innerHTML = html;
        document.body.appendChild(modal);
        modal.querySelector('#close-attendees-modal').addEventListener('click', function() { modal.remove(); });
        modal.addEventListener('click', function(e) { if (e.target === modal) modal.remove(); });
    }

    function renderEvents() {
        var el = $('#page-events');
        if (!el) return;
        el.innerHTML = '<div class="page-header"><div><div class="page-title">' + I18n.t('events_title') + '</div></div></div>' +
            '<div id="events-list-section"><div class="loader-spinner" style="margin:24px auto"></div></div>';
        if (!state.isOnline) {
            el.querySelector('#events-list-section').innerHTML = '<p style="color:var(--text-muted);font-size:13px;text-align:center;padding:24px">' + I18n.t('home_connect_error') + '</p>';
            return;
        }
        NovaAPI.getEvents(function(err, data) {
            var section = el.querySelector('#events-list-section');
            if (!section) return;
            if (err || !data) {
                section.innerHTML = '<p style="color:var(--text-muted);font-size:13px;text-align:center;padding:24px">' + I18n.t('events_error') + '</p>';
                return;
            }
            var events = data.events || [];
            if (events.length === 0) {
                section.innerHTML = '<p style="color:var(--text-muted);font-size:13px;text-align:center;padding:24px">' + I18n.t('events_empty') + '</p>';
                return;
            }
            var html = '<div class="events-list">';
            events.forEach(function(ev) {
                html += buildEventCardHtml(ev, true);
            });
            html += '</div>';
            section.innerHTML = html;
            bindEventCardHandlers(section, events, 'events');
        });
    }

    function showEventDetail(ev, fromPage) {
        var targetPage = fromPage || 'home';
        var el = $('#page-' + targetPage);
        if (!el) el = $('#page-home');
        if (!el) return;

        var dateStr = '';
        if (ev.event_date) {
            try {
                var d = new Date(ev.event_date);
                dateStr = d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            } catch(e) {}
        }

        var typeLabels = { sorteio: 'Sorteio', live: 'Live', torneio: 'Torneio', outro: 'Outro' };
        var typeColors = { sorteio: '#a78bfa', live: '#ef4444', torneio: '#f59e0b', outro: '#8b8ba3' };
        var typeBadgeColor = typeColors[ev.event_type] || '#8b8ba3';
        var typeLabel = typeLabels[ev.event_type] || ev.event_type;

        var viewCount = ev.view_count || 0;
        var rsvpCount = ev.rsvp_count || 0;

        var html = '<button class="back-btn" id="event-back-btn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg> ' + I18n.t('back') + '</button>';

        if (ev.cover_image_url) {
            html += '<div class="blog-detail-cover"><img src="' + escapeHtml(ev.cover_image_url) + '" alt=""></div>';
        }

        html += '<div class="blog-detail-header">' +
            '<h1 class="blog-detail-title">' + escapeHtml(ev.title) + '</h1>' +
            '<div class="blog-detail-meta">' +
                '<span class="event-type-badge" style="background:' + typeBadgeColor + ';margin-right:8px">' + escapeHtml(typeLabel) + '</span>' +
                (dateStr ? escapeHtml(dateStr) : '') +
                ' · <span class="blog-view-count"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12" style="vertical-align:-1px"><path d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.64 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.64 0-8.573-3.007-9.963-7.178z"/><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg> ' + viewCount + '</span>' +
                ' · <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12" style="vertical-align:-1px"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg> ' + rsvpCount + ' ' + (rsvpCount === 1 ? I18n.t('event_attendees_singular') : I18n.t('event_attendees')) +
            '</div>' +
        '</div>';

        if (ev.description) {
            html += '<div class="blog-detail-content card">' + escapeHtml(ev.description) + '</div>';
        }

        if (ev.event_url) {
            var safeUrl = sanitizeUrl(ev.event_url);
            if (safeUrl) {
                html += '<div class="event-detail-link card">' +
                    '<a href="' + escapeHtml(safeUrl) + '" target="_blank" rel="noopener noreferrer" style="color:var(--accent-light);display:flex;align-items:center;gap:8px">' +
                        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg> ' +
                        I18n.t('event_detail_link') +
                    '</a>' +
                '</div>';
            }
        }

        if (isCmsLoggedIn()) {
            var userHasRsvp = ev.user_has_rsvp || false;
            var rsvpBtnClass = userHasRsvp ? 'event-rsvp-btn confirmed' : 'event-rsvp-btn';
            var rsvpBtnText = userHasRsvp ? I18n.t('event_rsvp_leave') : I18n.t('event_rsvp_join');
            html += '<div style="margin:12px 0;display:flex;gap:8px;align-items:center">' +
                '<button class="' + rsvpBtnClass + '" id="event-detail-rsvp" data-rsvp-event="' + ev.id + '" style="flex:1;padding:12px">' + rsvpBtnText + '</button>' +
                '<button class="event-reminder-btn" id="event-reminder-btn" title="' + escapeHtml(I18n.t('event_reminder_tooltip')) + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg></button>' +
            '</div>';
        }

        html += '<div class="event-detail-tabs">' +
            '<button class="event-tab-btn active" data-tab="comments" id="event-tab-comments">' + I18n.t('event_tab_comments') + '</button>' +
            '<button class="event-tab-btn" data-tab="participants" id="event-tab-participants">' + I18n.t('event_tab_participants') + '</button>' +
        '</div>' +
        '<div id="event-tab-content-comments" class="event-tab-content active">' +
            '<div id="event-comments-section"><div class="loader-spinner" style="margin:16px auto"></div></div>' +
        '</div>' +
        '<div id="event-tab-content-participants" class="event-tab-content" style="display:none">' +
            '<div id="event-participants-section"><div class="loader-spinner" style="margin:16px auto"></div></div>' +
        '</div>';

        el.innerHTML = html;

        NovaAPI.postEventView(ev.id, function() {});

        el.querySelector('#event-back-btn').addEventListener('click', function() {
            if (targetPage === 'events') {
                renderEvents();
            } else {
                renderHome();
            }
        });

        var tabBtns = el.querySelectorAll('.event-tab-btn');
        tabBtns.forEach(function(btn) {
            btn.addEventListener('click', function() {
                tabBtns.forEach(function(b) { b.classList.remove('active'); });
                btn.classList.add('active');
                var tab = btn.getAttribute('data-tab');
                var commentsContent = el.querySelector('#event-tab-content-comments');
                var participantsContent = el.querySelector('#event-tab-content-participants');
                if (tab === 'comments') {
                    commentsContent.style.display = 'block';
                    commentsContent.classList.add('active');
                    participantsContent.style.display = 'none';
                    participantsContent.classList.remove('active');
                } else {
                    commentsContent.style.display = 'none';
                    commentsContent.classList.remove('active');
                    participantsContent.style.display = 'block';
                    participantsContent.classList.add('active');
                    loadEventParticipants(ev);
                }
            });
        });

        var rsvpBtn = el.querySelector('#event-detail-rsvp');
        if (rsvpBtn) {
            rsvpBtn.addEventListener('click', function() {
                rsvpBtn.disabled = true;
                NovaAPI.postEventRsvp(ev.id, function(err, resp) {
                    rsvpBtn.disabled = false;
                    if (err) return;
                    if (resp && resp.success) {
                        var isJoined = resp.has_rsvp === true;
                        rsvpBtn.className = isJoined ? 'event-rsvp-btn confirmed' : 'event-rsvp-btn';
                        rsvpBtn.textContent = isJoined ? I18n.t('event_rsvp_leave') : I18n.t('event_rsvp_join');
                    }
                });
            });
        }

        var reminderBtn = el.querySelector('#event-reminder-btn');
        if (reminderBtn) {
            NovaAPI.getEventReminderStatus(ev.id, function(err, resp) {
                if (!err && resp && resp.has_reminder) {
                    reminderBtn.classList.add('active');
                }
            });
            reminderBtn.addEventListener('click', function() {
                reminderBtn.disabled = true;
                NovaAPI.toggleEventReminder(ev.id, function(err, resp) {
                    reminderBtn.disabled = false;
                    if (err) return;
                    if (resp && resp.success) {
                        if (resp.has_reminder) {
                            reminderBtn.classList.add('active');
                            showToast(I18n.t('event_reminder_set'));
                        } else {
                            reminderBtn.classList.remove('active');
                            showToast(I18n.t('event_reminder_remove'));
                        }
                    }
                });
            });
        }

        loadEventComments(ev);
    }

    function loadEventComments(ev) {
        var section = $('#event-comments-section');
        if (!section) return;

        NovaAPI.getEventComments(ev.id, 1, function(err, data) {
            if (!section) return;
            var html = '';

            if (isCmsLoggedIn()) {
                html += '<div class="event-comment-form">' +
                    '<textarea id="event-comment-input" placeholder="' + escapeHtml(I18n.t('event_comment_placeholder')) + '" maxlength="1000" rows="2"></textarea>' +
                    '<button class="event-comment-submit" id="event-comment-submit">' + I18n.t('event_comment_send') + '</button>' +
                '</div>';
            } else {
                html += '<p style="color:var(--text-muted);font-size:13px;text-align:center;padding:8px 0 12px">' + I18n.t('event_comment_login_hint') + '</p>';
            }

            html += '<div id="event-comments-list">';
            if (err || !data || !data.comments || data.comments.length === 0) {
                html += '<p style="color:var(--text-muted);font-size:13px;text-align:center;padding:16px">' + I18n.t('event_no_comments') + '</p>';
            } else {
                html += renderEventCommentsList(data.comments);
            }
            html += '</div>';

            section.innerHTML = html;

            var submitBtn = section.querySelector('#event-comment-submit');
            var input = section.querySelector('#event-comment-input');
            if (submitBtn && input) {
                submitBtn.addEventListener('click', function() {
                    var text = input.value.trim();
                    if (!text) return;
                    submitBtn.disabled = true;
                    submitBtn.textContent = I18n.t('event_comment_sending');
                    NovaAPI.addEventComment(ev.id, text, function(err2, comment) {
                        submitBtn.disabled = false;
                        submitBtn.textContent = I18n.t('event_comment_send');
                        if (err2) return;
                        input.value = '';
                        var list = section.querySelector('#event-comments-list');
                        if (list) {
                            var noComments = list.querySelector('p');
                            if (noComments) noComments.remove();
                            list.insertAdjacentHTML('afterbegin', renderEventCommentItem(comment));
                        }
                    });
                });
            }
        });
    }

    function renderEventCommentsList(comments) {
        var html = '';
        comments.forEach(function(c) { html += renderEventCommentItem(c); });
        return html;
    }

    function renderEventCommentItem(c) {
        var author = c.author ? escapeHtml(c.author.display_name || I18n.t('guest_user')) : escapeHtml(I18n.t('guest_user'));
        var avatar = c.author && c.author.avatar_url ? escapeHtml(c.author.avatar_url) : '';
        var text = escapeHtml(c.comment_text || '');
        var dateStr = '';
        if (c.created_at) {
            try { dateStr = escapeHtml(new Date(c.created_at).toLocaleDateString()); } catch(e) {}
        }
        return '<div class="event-comment-item">' +
            '<div class="event-comment-header">' +
                (avatar ? '<img class="event-comment-avatar" src="' + avatar + '" alt="">' : '<div class="event-comment-avatar-placeholder"></div>') +
                '<span class="event-comment-author">' + author + '</span>' +
                (dateStr ? '<span class="event-comment-date">' + dateStr + '</span>' : '') +
            '</div>' +
            '<div class="event-comment-text">' + text + '</div>' +
        '</div>';
    }

    function loadEventParticipants(ev) {
        var section = $('#event-participants-section');
        if (!section) return;
        if (section.getAttribute('data-loaded')) return;
        section.setAttribute('data-loaded', '1');

        NovaAPI.getEventRsvp(ev.id, function(err, data) {
            if (!section) return;
            if (err || !data || !data.attendees || data.attendees.length === 0) {
                section.innerHTML = '<p style="color:var(--text-muted);font-size:13px;text-align:center;padding:16px">' + I18n.t('event_no_attendees') + '</p>';
                return;
            }
            var html = '<div class="event-participants-list">';
            data.attendees.forEach(function(a) {
                var name = escapeHtml(a.display_name || I18n.t('guest_user'));
                var avatar = a.avatar_url ? escapeHtml(a.avatar_url) : '';
                html += '<div class="event-participant-item">' +
                    (avatar ? '<img class="event-participant-avatar" src="' + avatar + '" alt="">' : '<div class="event-participant-avatar-placeholder"></div>') +
                    '<span class="event-participant-name">' + name + '</span>' +
                '</div>';
            });
            html += '</div>';
            section.innerHTML = html;
        });
    }

    function generateSlug(text) {
        return text.toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '')
            .substring(0, 80);
    }

    function showBlogPostDetail(post, fromPage) {
        var targetPage = fromPage || 'home';
        var el = $('#page-' + targetPage);
        if (!el) el = $('#page-home');
        if (!el) return;

        if (targetPage === 'news' && !state._blogDetailActive) {
            var slug = generateSlug(post.title || '');
            if (slug) {
                state._currentBlogPost = post;
                state._blogDetailActive = true;
                window.location.hash = '#novidades/' + slug;
            }
        }

        var dateStr = '';
        if (post.published_at) {
            try {
                var d = new Date(post.published_at);
                dateStr = d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            } catch(e) {}
        }

        var viewCount = post.view_count || 0;
        var html = '<button class="back-btn" id="blog-back-btn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg> Voltar</button>';

        if (post.cover_image_url) {
            html += '<div class="blog-detail-cover"><img src="' + escapeHtml(post.cover_image_url) + '" alt=""></div>';
        }

        html += '<div class="blog-detail-header">' +
            '<h1 class="blog-detail-title">' + escapeHtml(post.title) + '</h1>' +
            '<div class="blog-detail-meta">' + escapeHtml(dateStr) +
                (post.author ? ' · ' + escapeHtml(typeof post.author === 'string' ? post.author : (post.author.display_name || post.author.username || '')) : '') +
                ' · <span class="blog-view-count" id="blog-detail-views"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12" style="vertical-align:-1px"><path d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.64 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.64 0-8.573-3.007-9.963-7.178z"/><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg> ' + viewCount + '</span>' +
            '</div>' +
        '</div>' +
        '<div class="blog-detail-content card">' + sanitizeHtml(post.content || '') + '</div>' +
        '<div class="section-title">Comentários</div>' +
        '<div id="blog-comments-section"><div class="loader-spinner" style="margin:16px auto"></div></div>';

        el.innerHTML = html;

        NovaAPI.postBlogView(post.id, function(err, resp) {
            var viewsEl = $('#blog-detail-views');
            if (!viewsEl) return;
            if (!err && resp && typeof resp.view_count === 'number') {
                viewsEl.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12" style="vertical-align:-1px"><path d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.64 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.64 0-8.573-3.007-9.963-7.178z"/><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg> ' + resp.view_count;
            }
        });

        el.querySelector('#blog-back-btn').addEventListener('click', function() {
            state._currentBlogPost = null;
            state._blogDetailActive = false;
            if (targetPage === 'news') {
                window.location.hash = '#novidades';
            } else {
                renderHome();
            }
        });

        loadBlogComments(post.id, 1);
    }

    function loadBlogComments(postId, page) {
        var section = $('#blog-comments-section');
        if (!section) return;

        if (page === 1) {
            section.innerHTML = '<div class="loader-spinner" style="margin:16px auto"></div>';
        }

        NovaAPI.getBlogComments(postId, page, function(err, data) {
            if (!section) return;
            if (err || !data) {
                section.innerHTML = '<p style="color:var(--text-muted);font-size:13px;text-align:center;padding:16px">Não foi possível carregar comentários.</p>';
                return;
            }

            var comments = data.comments || [];
            var cmsProfile = NovaAPI.getCmsProfileData();
            var loggedIn = isCmsLoggedIn();

            var html = '';

            if (loggedIn) {
                html += '<div class="comment-form-wrap">' +
                    '<form id="blog-comment-form" class="comment-form">' +
                        '<textarea id="blog-comment-text" class="comment-textarea" placeholder="Escreva um comentário..." rows="3" maxlength="1000"></textarea>' +
                        '<div class="comment-form-actions">' +
                            '<span id="blog-comment-char-count" class="comment-char-count">0/1000</span>' +
                            '<button type="submit" class="btn btn-primary btn-sm" id="blog-comment-submit-btn">Enviar</button>' +
                        '</div>' +
                        '<p id="blog-comment-error" class="comment-error hidden"></p>' +
                    '</form>' +
                '</div>';
            } else {
                html += '<div class="comment-login-prompt">' +
                    '<p>' + I18n.t('event_comment_login_hint') + '</p>' +
                '</div>';
            }

            if (comments.length === 0 && page === 1) {
                html += '<div class="comment-empty"><p>Nenhum comentário ainda. Seja o primeiro!</p></div>';
            } else {
                html += '<div class="comment-list" id="blog-comment-list">';
                comments.forEach(function(c) {
                    html += renderBlogCommentItem(c, cmsProfile);
                });
                html += '</div>';

                if (data.page < data.pages) {
                    html += '<div class="comment-load-more">' +
                        '<button class="btn btn-secondary btn-sm" id="blog-comment-load-more" data-page="' + (data.page + 1) + '">Carregar mais</button>' +
                    '</div>';
                }
            }

            html += '<div class="comment-total" style="font-size:11px;color:var(--text-muted);text-align:center;margin-top:8px">' + (data.total || 0) + ' comentário(s)</div>';

            section.innerHTML = html;

            if (loggedIn) {
                bindBlogCommentForm(postId);
            }
            bindBlogCommentActions(postId);

            var loadMoreBtn = $('#blog-comment-load-more');
            if (loadMoreBtn) {
                loadMoreBtn.addEventListener('click', function() {
                    var nextPage = parseInt(this.getAttribute('data-page'));
                    appendBlogComments(postId, nextPage);
                });
            }
        });
    }

    function appendBlogComments(postId, page) {
        var loadMoreBtn = $('#blog-comment-load-more');
        if (loadMoreBtn) {
            loadMoreBtn.disabled = true;
            loadMoreBtn.textContent = 'Carregando...';
        }

        NovaAPI.getBlogComments(postId, page, function(err, data) {
            if (err || !data) return;
            var comments = data.comments || [];
            var cmsProfile = NovaAPI.getCmsProfileData();
            var list = $('#blog-comment-list');
            if (!list) return;

            comments.forEach(function(c) {
                list.insertAdjacentHTML('beforeend', renderBlogCommentItem(c, cmsProfile));
            });

            var loadMoreWrap = loadMoreBtn ? loadMoreBtn.parentElement : null;
            if (loadMoreWrap) {
                if (data.page < data.pages) {
                    loadMoreWrap.innerHTML = '<button class="btn btn-secondary btn-sm" id="blog-comment-load-more" data-page="' + (data.page + 1) + '">Carregar mais</button>';
                    var newBtn = $('#blog-comment-load-more');
                    if (newBtn) {
                        newBtn.addEventListener('click', function() {
                            appendBlogComments(postId, parseInt(this.getAttribute('data-page')));
                        });
                    }
                } else {
                    loadMoreWrap.remove();
                }
            }

            bindBlogCommentActions(postId);
        });
    }

    function renderBlogCommentItem(c, cmsProfile) {
        var up = c.userProfile || {};
        var displayName = escapeHtml(up.display_name || up.username || 'Anônimo');
        var avatarInitial = (up.display_name || up.username || '?')[0].toUpperCase();
        var avatarHtml = up.avatar_url
            ? '<img class="comment-avatar" src="' + escapeHtml(up.avatar_url) + '" alt="" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'">' +
              '<div class="comment-avatar-fallback" style="display:none">' + escapeHtml(avatarInitial) + '</div>'
            : '<div class="comment-avatar-fallback">' + escapeHtml(avatarInitial) + '</div>';

        var dateStr = '';
        if (c.created_at) {
            try {
                var d = new Date(c.created_at);
                dateStr = d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            } catch(e) { dateStr = c.created_at; }
        }

        var deleteBtn = '';
        if (cmsProfile && up.id === cmsProfile.id) {
            deleteBtn = '<button class="blog-comment-delete-btn comment-delete-btn" data-comment-id="' + c.id + '" title="Excluir">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>' +
            '</button>';
        }

        var authorTag = up.id
            ? '<a class="comment-author comment-author-link" data-profile-id="' + up.id + '" href="javascript:void(0)">' + displayName + '</a>'
            : '<span class="comment-author">' + displayName + '</span>';

        return '<div class="comment-item" data-comment-id="' + c.id + '">' +
            '<div class="comment-avatar-wrap">' + avatarHtml + '</div>' +
            '<div class="comment-body">' +
                '<div class="comment-header">' +
                    authorTag +
                    '<span class="comment-date">' + escapeHtml(dateStr) + '</span>' +
                    deleteBtn +
                '</div>' +
                '<div class="comment-text">' + escapeHtml(c.comment_text) + '</div>' +
            '</div>' +
        '</div>';
    }

    function bindBlogCommentForm(postId) {
        var form = $('#blog-comment-form');
        if (!form) return;

        var textarea = $('#blog-comment-text');
        var charCount = $('#blog-comment-char-count');
        if (textarea && charCount) {
            textarea.addEventListener('input', function() {
                charCount.textContent = this.value.length + '/1000';
            });
        }

        form.addEventListener('submit', function(e) {
            e.preventDefault();
            var text = textarea.value.trim();
            var errorEl = $('#blog-comment-error');
            var submitBtn = $('#blog-comment-submit-btn');

            if (!text) {
                if (errorEl) { errorEl.textContent = 'Escreva algo antes de enviar.'; errorEl.classList.remove('hidden'); }
                return;
            }

            if (errorEl) errorEl.classList.add('hidden');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Enviando...';

            NovaAPI.addBlogComment(postId, text, function(err, comment) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Enviar';

                if (err) {
                    if (errorEl) { errorEl.textContent = err.message || 'Erro ao enviar comentário'; errorEl.classList.remove('hidden'); }
                    return;
                }

                textarea.value = '';
                if (charCount) charCount.textContent = '0/1000';
                loadBlogComments(postId, 1);
            });
        });
    }

    function bindBlogCommentActions(postId) {
        document.querySelectorAll('.blog-comment-delete-btn').forEach(function(btn) {
            btn.onclick = function() {
                var commentId = this.getAttribute('data-comment-id');
                if (!confirm('Excluir este comentário?')) return;
                var item = this.closest('.comment-item');
                if (item) item.style.opacity = '0.5';

                NovaAPI.deleteBlogComment(postId, commentId, function(err) {
                    if (err) {
                        if (item) item.style.opacity = '1';
                        return;
                    }
                    loadBlogComments(postId, 1);
                });
            };
        });
        document.querySelectorAll('#blog-comments-section .comment-author-link').forEach(function(link) {
            link.onclick = function(e) {
                e.preventDefault();
                var pid = parseInt(this.getAttribute('data-profile-id'));
                if (pid) showUserPublicProfile(pid);
            };
        });
    }

    function notifIconSvg(type) {
        if (type === 'friend_request') {
            return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>';
        } else if (type === 'room_invite' || type === 'room_reminder') {
            return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>';
        } else if (type === 'achievement') {
            return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M12 15l-2 5 2-1 2 1-2-5z"/><circle cx="12" cy="8" r="6"/></svg>';
        }
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
    }

    function notifTimeStr(n) {
        var ts = n.createdAt || n.created_at;
        if (!ts) return '';
        try {
            var d = new Date(ts);
            var diffMin = Math.floor((Date.now() - d) / 60000);
            if (diffMin < 1) return I18n.t('notif_time_now');
            if (diffMin < 60) return diffMin + 'min';
            if (diffMin < 1440) return Math.floor(diffMin / 60) + 'h';
            return Math.floor(diffMin / 1440) + 'd';
        } catch(e) { return ''; }
    }

    function renderNotifItems(notifs, isArchived) {
        var html = '';
        notifs.forEach(function(n) {
            var readClass = n.read ? ' cms-notif-read' : '';
            var timeStr = notifTimeStr(n);
            var archiveSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>';
            var deleteSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';
            var actions = '<div class="cms-notif-actions">';
            if (!isArchived) {
                actions += '<button class="cms-notif-action-btn cms-notif-archive-btn" data-nid="' + n.id + '" title="' + I18n.t('notif_archive') + '">' + archiveSvg + '</button>';
            }
            actions += '<button class="cms-notif-action-btn cms-notif-delete-btn" data-nid="' + n.id + '" title="' + I18n.t('notif_delete') + '">' + deleteSvg + '</button>';
            actions += '</div>';
            html += '<div class="cms-notif-item' + readClass + '" data-notif-id="' + n.id + '" data-notif-type="' + escapeHtml(n.type) + '" data-notif-data=\'' + escapeHtml(JSON.stringify(n.data || {})) + '\'>' +
                '<div class="cms-notif-icon">' + notifIconSvg(n.type) + '</div>' +
                '<div class="cms-notif-body">' +
                    '<div class="cms-notif-title">' + escapeHtml(n.title) + '</div>' +
                    (n.message ? '<div class="cms-notif-msg">' + escapeHtml(n.message) + '</div>' : '') +
                '</div>' +
                (timeStr ? '<div class="cms-notif-time">' + timeStr + '</div>' : '') +
                actions +
            '</div>';
        });
        return html;
    }

    function showNotificationPanel(bellEl) {
        var notifs = (state.cmsNotifications && state.cmsNotifications.notifications) || [];
        var panel = document.createElement('div');
        panel.id = 'cms-notif-panel';
        panel.className = 'cms-notif-panel';

        var tabsHtml = '<div class="cms-notif-tabs">' +
            '<button class="cms-notif-tab active" data-tab="main">' + I18n.t('notif_tab_main') + '</button>' +
            '<button class="cms-notif-tab" data-tab="archived">' + I18n.t('notif_tab_archived') + '</button>' +
        '</div>';

        var mainContent = notifs.length === 0
            ? '<div class="cms-notif-empty">' + I18n.t('notif_empty') + '</div>'
            : '<div class="cms-notif-list">' + renderNotifItems(notifs, false) + '</div>';

        panel.innerHTML = tabsHtml + '<div class="cms-notif-tab-content" id="notif-tab-main">' + mainContent + '</div>' +
            '<div class="cms-notif-tab-content hidden" id="notif-tab-archived"><div class="cms-notif-loading">' + I18n.t('loading') + '</div></div>';

        panel._bellEl = bellEl;

        var parent = bellEl.closest('.section-title') || bellEl.parentElement;
        parent.style.position = 'relative';
        parent.appendChild(panel);

        panel.querySelectorAll('.cms-notif-tab').forEach(function(tab) {
            tab.addEventListener('click', function(e) {
                e.stopPropagation();
                panel.querySelectorAll('.cms-notif-tab').forEach(function(t) { t.classList.remove('active'); });
                tab.classList.add('active');
                var which = tab.getAttribute('data-tab');
                panel.querySelector('#notif-tab-main').classList.toggle('hidden', which !== 'main');
                panel.querySelector('#notif-tab-archived').classList.toggle('hidden', which !== 'archived');
                if (which === 'archived') {
                    loadArchivedNotifications(panel);
                }
            });
        });

        bindNotifItemEvents(panel, bellEl, false);

        var closePanel = function(e) {
            if (!panel.contains(e.target) && e.target !== bellEl && !bellEl.contains(e.target)) {
                panel.remove();
                document.removeEventListener('click', closePanel);
            }
        };
        setTimeout(function() {
            document.addEventListener('click', closePanel);
        }, 10);
    }

    function loadArchivedNotifications(panel) {
        var container = panel.querySelector('#notif-tab-archived');
        if (!state.cmsProfile) return;
        NovaAPI.getArchivedNotifications(state.cmsProfile.id, function(err, data) {
            if (err || !data) {
                container.innerHTML = '<div class="cms-notif-empty">' + I18n.t('notif_empty') + '</div>';
                return;
            }
            var archived = data.notifications || [];
            if (archived.length === 0) {
                container.innerHTML = '<div class="cms-notif-empty">' + I18n.t('notif_empty') + '</div>';
            } else {
                container.innerHTML = '<div class="cms-notif-list">' + renderNotifItems(archived, true) + '</div>';
            }
            bindNotifItemEvents(panel, panel._bellEl, true);
        });
    }

    function updateNotifBadge(bellEl) {
        if (!bellEl || !state.cmsNotifications) return;
        var badge = bellEl.querySelector('.cms-notif-count') || bellEl.querySelector('.hb-notif-badge');
        if (state.cmsNotifications.unread_count > 0) {
            if (badge) badge.textContent = state.cmsNotifications.unread_count > 9 ? '9+' : state.cmsNotifications.unread_count;
        } else {
            if (badge) badge.remove();
        }
    }

    function bindNotifItemEvents(panel, bellEl, isArchived) {
        var tabId = isArchived ? '#notif-tab-archived' : '#notif-tab-main';
        var container = panel.querySelector(tabId);
        if (!container) return;

        container.querySelectorAll('.cms-notif-archive-btn').forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                var nid = parseInt(btn.getAttribute('data-nid'));
                var item = btn.closest('.cms-notif-item');
                var wasUnread = item && !item.classList.contains('cms-notif-read');
                NovaAPI.archiveNotification(nid, function(err) {
                    if (!err && item) {
                        item.remove();
                        if (state.cmsNotifications) {
                            if (state.cmsNotifications.notifications) {
                                state.cmsNotifications.notifications = state.cmsNotifications.notifications.filter(function(n) { return n.id !== nid; });
                            }
                            if (wasUnread && state.cmsNotifications.unread_count > 0) {
                                state.cmsNotifications.unread_count--;
                                updateNotifBadge(bellEl);
                            }
                        }
                        var mainTab = panel.querySelector('#notif-tab-main');
                        if (mainTab && mainTab.querySelectorAll('.cms-notif-item').length === 0) {
                            mainTab.innerHTML = '<div class="cms-notif-empty">' + I18n.t('notif_empty') + '</div>';
                        }
                    }
                });
            });
        });

        container.querySelectorAll('.cms-notif-delete-btn').forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                if (!confirm(I18n.t('notif_delete_confirm'))) return;
                var nid = parseInt(btn.getAttribute('data-nid'));
                var item = btn.closest('.cms-notif-item');
                var wasUnread = !isArchived && item && !item.classList.contains('cms-notif-read');
                NovaAPI.deleteNotification(nid, function(err) {
                    if (!err && item) {
                        item.remove();
                        if (!isArchived && state.cmsNotifications && state.cmsNotifications.notifications) {
                            state.cmsNotifications.notifications = state.cmsNotifications.notifications.filter(function(n) { return n.id !== nid; });
                        }
                        if (wasUnread && state.cmsNotifications && state.cmsNotifications.unread_count > 0) {
                            state.cmsNotifications.unread_count--;
                            updateNotifBadge(bellEl);
                        }
                        var listContainer = item.closest('.cms-notif-tab-content');
                        if (listContainer && listContainer.querySelectorAll('.cms-notif-item').length === 0) {
                            listContainer.innerHTML = '<div class="cms-notif-empty">' + I18n.t('notif_empty') + '</div>';
                        }
                    }
                });
            });
        });

        container.querySelectorAll('.cms-notif-item').forEach(function(item) {
            item.addEventListener('click', function() {
                var nid = parseInt(item.getAttribute('data-notif-id'));
                var ntype = item.getAttribute('data-notif-type');
                var ndata = {};
                try { ndata = JSON.parse(item.getAttribute('data-notif-data')); } catch(e) {}

                if (!item.classList.contains('cms-notif-read')) {
                    NovaAPI.markNotificationRead(nid, function() {});
                    item.classList.add('cms-notif-read');
                    if (state.cmsNotifications && state.cmsNotifications.unread_count > 0) {
                        state.cmsNotifications.unread_count--;
                        updateNotifBadge(bellEl);
                        var n = state.cmsNotifications.notifications;
                        if (n) {
                            for (var i = 0; i < n.length; i++) {
                                if (n[i].id === nid) { n[i].read = true; break; }
                            }
                        }
                    }
                }

                panel.remove();

                if (ntype === 'friend_request') {
                    navigateTo('friends');
                } else if (ntype === 'room_invite' || ntype === 'room_reminder') {
                    navigateTo('rooms');
                    if (ndata && ndata.room_id) {
                        setTimeout(function() { loadRoomDetail(ndata.room_id); }, 200);
                    }
                } else if (ntype === 'achievement') {
                    navigateTo('home');
                }
            });
        });
    }


    function renderTempCard(label, temp) {
        var pct = Math.min(100, Math.round((temp / 100) * 100));
        return '<div class="info-item">' +
            '<div class="info-label">' + label + '</div>' +
            '<div class="info-value ' + getTempClass(temp) + '">' + temp + '°C</div>' +
            '<div class="temp-bar"><div class="temp-bar-fill" style="width:' + pct + '%;background:' + getTempColor(temp) + '"></div></div>' +
        '</div>';
    }

    function renderGames() {
        var el = $('#page-games');
        applyGameFilter();

        if (state.selectedGame) {
            var selectedStillVisible = state.filteredGames.some(function(g) {
                return getGameId(g) === getGameId(state.selectedGame);
            });
            if (!selectedStillVisible) {
                state.selectedGame = null;
            }
        }

        var totalPages = Math.ceil(state.filteredGames.length / state.gamesPerPage) || 1;
        if (state.gamePage > totalPages) state.gamePage = totalPages;
        if (state.gamePage < 1) state.gamePage = 1;
        var pageStart = (state.gamePage - 1) * state.gamesPerPage;
        var pageEnd = pageStart + state.gamesPerPage;
        var pageGames = state.filteredGames.slice(pageStart, pageEnd);

        var needsFullRender = !$('#game-grid-wrap');

        if (needsFullRender) {
            var searchBarHtml = '<div class="search-bar">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>' +
                '<input type="text" id="game-search" placeholder="Search games..." value="' + escapeHtml(state.searchQuery) + '">' +
            '</div>';

            var tabsHtml = '<div class="tabs" id="game-tabs">' +
                renderTab('all', 'All') +
                renderTab('1', 'Xbox 360') +
                renderTab('2', 'Arcade') +
                renderTab('3', 'Indie') +
                renderTab('homebrew', 'Homebrew') +
                renderTab('4', 'OG Xbox') +
            '</div>';

            el.innerHTML = '<div class="page-header"><div class="page-title" id="game-page-title">' +
                getGameFilterLabel() +
                ' Games</div><div class="page-subtitle" id="game-page-subtitle">' + state.filteredGames.length + ' Titles</div></div>' +
                searchBarHtml + tabsHtml +
                '<div id="game-grid-wrap"></div>';

            var searchInput = $('#game-search');
            if (searchInput) {
                searchInput.addEventListener('input', function(e) {
                    state.searchQuery = e.target.value;
                    state.gamePage = 1;
                    renderGames();
                });
            }

            $$('#game-tabs .tab').forEach(function(tab) {
                tab.addEventListener('click', function() {
                    state.gameFilter = this.dataset.filter;
                    state.gamePage = 1;
                    renderGames();
                });
            });
        }

        var titleEl = $('#game-page-title');
        var subtitleEl = $('#game-page-subtitle');
        if (titleEl) titleEl.textContent = getGameFilterLabel() + ' Games';
        if (subtitleEl) subtitleEl.textContent = state.filteredGames.length + ' Titles';

        $$('#game-tabs .tab').forEach(function(tab) {
            if (tab.dataset.filter === state.gameFilter) tab.classList.add('active');
            else tab.classList.remove('active');
        });

        var viewToggleHtml = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">' +
            '<div class="game-count">' + state.filteredGames.length + ' games</div>' +
            '<div class="view-toggle">' +
                '<button class="' + (state.gameView === 'grid' ? 'active' : '') + '" data-view="grid"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg></button>' +
                '<button class="' + (state.gameView === 'list' ? 'active' : '') + '" data-view="list"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg></button>' +
            '</div>' +
        '</div>';

        var gamesHtml = '';
        if (state.filteredGames.length === 0) {
            gamesHtml = '<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="2"/></svg><p>No games found</p></div>';
        } else if (state.gameView === 'grid') {
            gamesHtml = '<div class="game-grid">';
            pageGames.forEach(function(g) {
                var imgUrl = getGameArt(g) || '';
                var isCmsUrl = imgUrl && (imgUrl.indexOf('http://') === 0 || imgUrl.indexOf('https://') === 0);
                var imgAttr = imgUrl ? (isCmsUrl ? 'src="' + escapeHtml(imgUrl) + '"' : 'data-auth-src="' + escapeHtml(imgUrl) + '"') : 'src="img/noboxart.svg"';
                var hasLaunch = !!(g.directory && g.executable);
                var launchBtnHtml = hasLaunch ?
                    '<button class="game-card-launch" data-titleid="' + escapeHtml(getGameId(g)) + '" title="Launch">' +
                        '<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>' +
                    '</button>' : '';
                gamesHtml += '<div class="game-card" data-titleid="' + escapeHtml(getGameId(g)) + '">' +
                    '<div class="game-card-img-wrapper">' +
                        '<img class="game-card-img" ' + imgAttr + ' alt="" loading="lazy" onerror="this.onerror=null;this.src=\'img/noboxart.svg\'">' +
                        launchBtnHtml +
                    '</div>' +
                    '<div class="game-card-info">' +
                        '<div class="game-card-title">' + escapeHtml(getGameName(g)) + '</div>' +
                        '<div class="game-card-type">' + gameTypeLabel(getGameType(g)) + '</div>' +
                    '</div>' +
                '</div>';
            });
            gamesHtml += '</div>';
        } else {
            gamesHtml = '<div class="game-list-container">';
            pageGames.forEach(function(g) {
                var imgUrl = getGameArt(g) || '';
                var tileUrl = '';
                if (g.art) tileUrl = g.art.tile || g.art.boxartLarge || g.art.boxartSmall || '';
                if (!tileUrl) tileUrl = imgUrl;
                var isCmsUrl = tileUrl && (tileUrl.indexOf('http://') === 0 || tileUrl.indexOf('https://') === 0);
                var imgAttr = tileUrl ? (isCmsUrl ? 'src="' + escapeHtml(tileUrl) + '"' : 'data-auth-src="' + escapeHtml(tileUrl) + '"') : 'src="img/noboxart.svg"';
                var selectedClass = (state.selectedGame && getGameId(state.selectedGame) === getGameId(g)) ? ' selected' : '';
                var hasLaunch = !!(g.directory && g.executable);
                var launchBtnHtml = hasLaunch ?
                    '<button class="game-list-launch" data-titleid="' + escapeHtml(getGameId(g)) + '" title="Launch">' +
                        '<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>' +
                    '</button>' : '';
                gamesHtml += '<div class="game-list-item' + selectedClass + '" data-titleid="' + escapeHtml(getGameId(g)) + '">' +
                    '<img class="game-list-thumb" ' + imgAttr + ' alt="" loading="lazy" onerror="this.onerror=null;this.src=\'img/noboxart.svg\'">' +
                    '<div class="game-list-info">' +
                        '<div class="game-list-title">' + escapeHtml(getGameName(g)) + '</div>' +
                        '<div class="game-list-meta">' + gameTypeLabel(getGameType(g)) + '</div>' +
                    '</div>' +
                    launchBtnHtml +
                '</div>';
            });
            gamesHtml += '</div>';
        }

        var paginationHtml = '';
        if (totalPages > 1) {
            paginationHtml = '<div class="games-pagination">';
            paginationHtml += '<button class="games-page-btn" data-page="prev"' + (state.gamePage <= 1 ? ' disabled' : '') + '>&laquo;</button>';
            var startPage = Math.max(1, state.gamePage - 2);
            var endPage = Math.min(totalPages, startPage + 4);
            if (endPage - startPage < 4) startPage = Math.max(1, endPage - 4);
            for (var p = startPage; p <= endPage; p++) {
                paginationHtml += '<button class="games-page-btn' + (p === state.gamePage ? ' active' : '') + '" data-page="' + p + '">' + p + '</button>';
            }
            paginationHtml += '<button class="games-page-btn" data-page="next"' + (state.gamePage >= totalPages ? ' disabled' : '') + '>&raquo;</button>';
            paginationHtml += '</div>';
        }

        var gridWrap = $('#game-grid-wrap');
        if (gridWrap) {
            gridWrap.innerHTML = viewToggleHtml + gamesHtml + paginationHtml;
        }

        $$('.games-page-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var pg = this.dataset.page;
                if (pg === 'prev') { state.gamePage = Math.max(1, state.gamePage - 1); }
                else if (pg === 'next') { state.gamePage = Math.min(totalPages, state.gamePage + 1); }
                else { state.gamePage = parseInt(pg); }
                renderGames();
                el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
        });

        $$('.view-toggle button').forEach(function(btn) {
            btn.addEventListener('click', function() {
                state.gameView = this.dataset.view;
                if (this.dataset.view === 'grid') {
                    state.selectedGame = null;
                }
                renderGames();
            });
        });

        $$('img[data-auth-src]').forEach(function(img) {
            NovaAPI.loadAuthImage(img.getAttribute('data-auth-src'), img);
        });

        $$('.game-card').forEach(function(card) {
            card.addEventListener('click', function(e) {
                if (e.target.closest('.game-card-launch')) return;
                var tid = this.dataset.titleid;
                showGameDetail(tid);
            });
        });

        $$('.game-list-item').forEach(function(item) {
            item.addEventListener('click', function(e) {
                if (e.target.closest('.game-list-launch')) return;
                var tid = this.dataset.titleid;
                showGameDetail(tid);
            });
        });

        $$('.game-card-launch, .game-list-launch').forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                e.preventDefault();
                var self = this;
                var tid = this.dataset.titleid;
                var game = state.games.find(function(g) { return getGameId(g) === tid; });
                if (game && game.directory && game.executable) {
                    self.disabled = true;
                    self.style.background = 'rgba(255,165,0,0.9)';
                    NovaAPI.launchTitle(game, function(err) {
                        if (err) {
                            self.style.background = 'rgba(244,67,54,0.9)';
                            setTimeout(function() {
                                self.disabled = false;
                                self.style.background = '';
                            }, 2000);
                        } else {
                            self.style.background = 'rgba(76,175,80,0.9)';
                            setTimeout(function() {
                                self.disabled = false;
                                self.style.background = '';
                            }, 3000);
                        }
                    });
                }
            });
        });

    }

    function renderTab(filter, label) {
        return '<button class="tab ' + (state.gameFilter === filter ? 'active' : '') + '" data-filter="' + filter + '">' + label + '</button>';
    }

    function applyGameFilter() {
        state.filteredGames = state.games.filter(function(g) {
            if (g.hidden) return false;
            var cg = String(getGameType(g));
            var matchType;
            if (state.gameFilter === 'all') {
                matchType = true;
            } else if (state.gameFilter === 'homebrew') {
                matchType = cg === '5' || cg === '6' || cg === '7';
            } else {
                matchType = cg === state.gameFilter;
            }
            var matchSearch = !state.searchQuery || getGameName(g).toLowerCase().indexOf(state.searchQuery.toLowerCase()) !== -1;
            return matchType && matchSearch;
        });
    }

    function showGameDetail(titleId) {
        var game = state.games.find(function(g) {
            var gid = getGameId(g);
            return gid && gid.toLowerCase() === titleId.toLowerCase();
        });
        if (!game) return;

        state.selectedGame = game;
        var el = $('#page-games');
        var bannerUrl = getGameBanner(game) || '';
        var bannerAttr = bannerUrl ? 'data-auth-src="' + escapeHtml(bannerUrl) + '"' : 'src="img/noboxart.svg"';
        var boxartUrl = getGameBoxartLarge(game);
        var boxartAttr = boxartUrl ? 'data-auth-src="' + escapeHtml(boxartUrl) + '"' : 'src="img/noboxart.svg"';

        var currentTid = getTitleIdFromState();
        var isRunning = currentTid && currentTid.toLowerCase() === titleId.toLowerCase();
        var ti = isRunning ? state.title : null;

        var metaItems = '';
        metaItems += '<div class="game-detail-meta-item"><span class="game-detail-meta-label">Title ID</span><span class="game-detail-meta-value" style="font-family:monospace">' + escapeHtml(getGameId(game)) + '</span></div>';
        metaItems += '<div class="game-detail-meta-item"><span class="game-detail-meta-label">Type</span><span class="game-detail-meta-value">' + gameTypeLabel(getGameType(game)) + '</span></div>';

        if (ti && ti.mediaid) {
            metaItems += '<div class="game-detail-meta-item"><span class="game-detail-meta-label">Media ID</span><span class="game-detail-meta-value" style="font-family:monospace">' + escapeHtml(ti.mediaid) + '</span></div>';
        }
        if (ti && ti.disc) {
            metaItems += '<div class="game-detail-meta-item"><span class="game-detail-meta-label">Disc</span><span class="game-detail-meta-value">' + safeStr(ti.disc.current) + ' / ' + safeStr(ti.disc.count) + '</span></div>';
        }
        if (ti && ti.version) {
            if (ti.version.base) metaItems += '<div class="game-detail-meta-item"><span class="game-detail-meta-label">Base Version</span><span class="game-detail-meta-value">' + escapeHtml(safeStr(ti.version.base)) + '</span></div>';
            if (ti.version.current) metaItems += '<div class="game-detail-meta-item"><span class="game-detail-meta-label">Current Version</span><span class="game-detail-meta-value">' + escapeHtml(safeStr(ti.version.current)) + '</span></div>';
        }
        if (ti && ti.tuver != null) {
            metaItems += '<div class="game-detail-meta-item"><span class="game-detail-meta-label">TU Version</span><span class="game-detail-meta-value">' + escapeHtml(safeStr(ti.tuver)) + '</span></div>';
        }
        if (ti && ti.resolution) {
            metaItems += '<div class="game-detail-meta-item"><span class="game-detail-meta-label">Resolution</span><span class="game-detail-meta-value">' + safeStr(ti.resolution.width) + ' × ' + safeStr(ti.resolution.height) + '</span></div>';
        }
        var gamePath = getGamePath(game);
        if (gamePath) {
            metaItems += '<div class="game-detail-meta-item game-detail-meta-path"><span class="game-detail-meta-label">Path</span><span class="game-detail-meta-value" style="font-family:monospace;font-size:11px;word-break:break-all">' + escapeHtml(gamePath) + '</span></div>';
        }

        var screenshots = getGameScreenshots(game);
        var screenshotsHtml = '';
        if (screenshots.length > 0) {
            screenshotsHtml = '<div class="detail-section"><div class="section-title">Screenshots <span class="badge badge-accent">' + screenshots.length + '</span></div>' +
                '<div class="game-screenshots-grid">';
            screenshots.forEach(function(ssUrl, idx) {
                screenshotsHtml += '<div class="game-screenshot-item" data-ss-idx="' + idx + '">' +
                    '<img class="game-screenshot-img" data-auth-src="' + escapeHtml(ssUrl) + '" alt="" onerror="this.onerror=null;this.src=\'img/noboxart.svg\'">' +
                '</div>';
            });
            screenshotsHtml += '</div></div>';
        }

        var descriptionHtml = '';

        var html = '<button class="back-btn" id="back-to-games">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg> Back' +
        '</button>' +
        '<div class="game-detail-header">' +
            '<img class="game-detail-bg" ' + bannerAttr + ' alt="" onerror="this.onerror=null;this.src=\'img/noboxart.svg\'">' +
            '<div class="game-detail-overlay">' +
                '<div class="game-detail-title-row">' +
                    '<div class="game-detail-title">' + escapeHtml(getGameName(game)) + '</div>' +
                    (isRunning ? '<span class="badge badge-success">Now Playing</span>' : '') +
                '</div>' +
            '</div>' +
            '<div id="game-favorite-btn-wrap"></div>' +
        '</div>' +
        '<div class="game-detail-body">' +
            '<div class="game-detail-sidebar">' +
                '<img class="game-detail-boxart" ' + boxartAttr + ' alt="" onerror="this.onerror=null;this.src=\'img/noboxart.svg\'">' +
                (game.directory && game.executable ? '<button class="btn btn-primary btn-block" id="launch-game" style="margin-top:12px">' +
                    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px"><polygon points="5 3 19 12 5 21 5 3"/></svg> Launch Game' +
                '</button>' : '') +
                '<div id="sidebar-trailer-btn-wrap"></div>' +
            '</div>' +
            '<div class="game-detail-main">' +
                '<div class="game-detail-tabs">' +
                    '<button class="game-detail-tab active" data-detail-tab="description">Descrição</button>' +
                    (state.isOnline ? '<button class="game-detail-tab" data-detail-tab="comments">Comentários</button>' : '') +
                    '<button class="game-detail-tab" data-detail-tab="extrainfo">Informações Extras</button>' +
                '</div>' +
                '<div id="game-tab-description" class="game-tab-content">' +
                    '<div id="game-description-section" class="game-description-section">' +
                        '<div class="game-description"><p class="game-desc-text" style="color:var(--text-muted)">Carregando descrição...</p></div>' +
                    '</div>' +
                '</div>' +
                (state.isOnline ? '<div id="game-tab-comments" class="game-tab-content" style="display:none">' +
                    '<div id="game-comments-section"><div class="loader-spinner" style="margin:16px auto"></div></div>' +
                '</div>' : '') +
                '<div id="game-tab-extrainfo" class="game-tab-content" style="display:none">' +
                    '<div class="game-detail-meta">' + metaItems + '</div>' +
                '</div>' +
            '</div>' +
        '</div>' +
        screenshotsHtml +
        '<div id="achievements-section" class="detail-section">' +
            '<div class="section-title"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16" style="vertical-align:-2px;margin-right:4px"><rect x="2" y="6" width="20" height="12" rx="2"/><line x1="6" y1="12" x2="10" y2="12"/><line x1="8" y1="10" x2="8" y2="14"/><circle cx="16" cy="10" r="1"/><circle cx="18" cy="12" r="1"/></svg>Game Achievements</div>' +
            '<div class="card"><div class="loader-spinner" style="margin:16px auto"></div></div>' +
        '</div>' +
        '';

        el.innerHTML = html;

        $('#back-to-games').addEventListener('click', function() {
            state.selectedGame = null;
            renderGames();
        });

        var launchBtn = $('#launch-game');
        if (launchBtn) {
            launchBtn.addEventListener('click', function() {
                var btn = this;
                btn.disabled = true;
                btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px"><polygon points="5 3 19 12 5 21 5 3"/></svg> Launching...';
                NovaAPI.launchTitle(game, function(err) {
                    if (err) {
                        btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px"><polygon points="5 3 19 12 5 21 5 3"/></svg> Error!';
                        btn.style.background = 'var(--danger)';
                    } else {
                        btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px"><polygon points="5 3 19 12 5 21 5 3"/></svg> Launched!';
                    }
                    setTimeout(function() {
                        btn.disabled = false;
                        btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px"><polygon points="5 3 19 12 5 21 5 3"/></svg> Launch Game';
                        btn.style.background = '';
                    }, 3000);
                });
            });
        }

        document.querySelectorAll('.game-screenshot-item').forEach(function(item) {
            item.addEventListener('click', function() {
                var img = this.querySelector('.game-screenshot-img');
                if (!img) return;
                var src = img.getAttribute('data-auth-src') || img.src;
                if (src) openGameScreenshot(src);
            });
        });

        $$('img[data-auth-src]').forEach(function(img) {
            NovaAPI.loadAuthImage(img.getAttribute('data-auth-src'), img);
        });

        var commentsLoaded = false;
        document.querySelectorAll('.game-detail-tab').forEach(function(tab) {
            tab.addEventListener('click', function() {
                var target = this.getAttribute('data-detail-tab');
                document.querySelectorAll('.game-detail-tab').forEach(function(t) { t.classList.remove('active'); });
                this.classList.add('active');
                document.querySelectorAll('.game-tab-content').forEach(function(c) { c.style.display = 'none'; });
                var panel = $('#game-tab-' + target);
                if (panel) panel.style.display = '';
                if (target === 'comments' && !commentsLoaded) {
                    commentsLoaded = true;
                    var commentTid = getGameId(game);
                    var commentName = getGameName(game);
                    if (commentTid && state.isOnline) {
                        autoRegisterGameIfNeeded(commentTid, function() {
                            loadGameComments(commentTid, commentName, 1);
                        });
                    } else {
                        loadGameComments(commentTid, commentName, 1);
                    }
                }
            });
        });

        function extractYouTubeId(url) {
            if (!url) return null;
            var m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
            return m ? m[1] : null;
        }

        function openTrailerModal(youtubeUrl) {
            var videoId = extractYouTubeId(youtubeUrl);
            if (!videoId) return;
            var existing = $('#trailer-modal');
            if (existing) existing.remove();
            var modal = document.createElement('div');
            modal.id = 'trailer-modal';
            modal.className = 'trailer-modal';
            modal.innerHTML = '<div class="trailer-modal-backdrop"></div>' +
                '<div class="trailer-modal-content">' +
                    '<button class="trailer-modal-close" id="trailer-modal-close">&times;</button>' +
                    '<iframe class="trailer-modal-iframe" src="https://www.youtube.com/embed/' + videoId + '?autoplay=1&rel=0" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>' +
                '</div>';
            document.body.appendChild(modal);
            modal.querySelector('.trailer-modal-backdrop').addEventListener('click', function() { modal.remove(); });
            modal.querySelector('#trailer-modal-close').addEventListener('click', function() { modal.remove(); });
        }

        function renderDescriptionSection(desc, developer, publisher, releaseDate, youtubeTrailerUrl) {
            var descEl = $('#game-description-section');
            if (!descEl) return;
            var extra = '';
            if (developer) extra += '<span class="game-desc-meta"><strong>Developer:</strong> ' + escapeHtml(developer) + '</span>';
            if (publisher) extra += '<span class="game-desc-meta"><strong>Publisher:</strong> ' + escapeHtml(publisher) + '</span>';
            if (releaseDate) extra += '<span class="game-desc-meta"><strong>Release:</strong> ' + escapeHtml(releaseDate) + '</span>';
            descEl.innerHTML = '<div class="game-description">' +
                (extra ? '<div class="game-desc-meta-row">' + extra + '</div>' : '') +
                '<p class="game-desc-text">' + escapeHtml(desc) + '</p>' +
            '</div>';
            var sidebarWrap = $('#sidebar-trailer-btn-wrap');
            if (sidebarWrap && youtubeTrailerUrl && extractYouTubeId(youtubeTrailerUrl)) {
                sidebarWrap.innerHTML = '<button class="btn btn-trailer btn-block" id="play-trailer-btn" style="margin-top:8px">' +
                    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><polygon points="5 3 19 12 5 21 5 3"/></svg>' +
                    ' Play Trailer</button>';
                var tBtn = sidebarWrap.querySelector('#play-trailer-btn');
                if (tBtn) {
                    tBtn.addEventListener('click', function() { openTrailerModal(youtubeTrailerUrl); });
                }
            }
        }

        var gameTitleId = getGameId(game);
        var descLoaded = false;

        function fallbackToDbox() {
            NovaAPI.getDBoxDescription(gameTitleId, function(err, dbox) {
                if (descLoaded) return;
                if (!err && dbox && dbox.description) {
                    descLoaded = true;
                    var relDate = '';
                    if (dbox.release_date) {
                        try { relDate = dbox.release_date.substring(0, 10); } catch(e) {}
                    }
                    renderDescriptionSection(dbox.description, dbox.developer, dbox.publisher, relDate);
                } else if (isRunning) {
                    NovaAPI.getLiveInfo(function(err, info) {
                        if (descLoaded) return;
                        var descEl = $('#game-description-section');
                        if (!descEl) return;
                        if (!err && info && (info.description || info.reduceddescription)) {
                            descLoaded = true;
                            var desc = info.description || info.reduceddescription;
                            renderDescriptionSection(desc, info.developer, info.publisher, info.releasedate);
                        } else {
                            descEl.innerHTML = '<div class="game-description"><p class="game-desc-text" style="color:var(--text-muted)">Nenhuma descrição disponível.</p></div>';
                        }
                    });
                } else {
                    var descEl = $('#game-description-section');
                    if (descEl) {
                        descEl.innerHTML = '<div class="game-description"><p class="game-desc-text" style="color:var(--text-muted)">Nenhuma descrição disponível.</p></div>';
                    }
                }
            });
        }

        NovaAPI.getCmsGameByTitleId(gameTitleId, function(err, cmsGame) {
            if (!err && cmsGame && cmsGame.description) {
                descLoaded = true;
                var relDate = '';
                if (cmsGame.release_date) {
                    try { relDate = String(cmsGame.release_date).substring(0, 10); } catch(e) {}
                }
                renderDescriptionSection(cmsGame.description, null, cmsGame.publisher, relDate, cmsGame.youtube_trailer_url);
            } else {
                fallbackToDbox();
            }
            if (!err && cmsGame && cmsGame.status === 'active' && cmsGame.id && isCmsLoggedIn() && state.cmsProfile) {
                loadFavoriteButton(cmsGame.id);
            }
        });

        loadAchievements(titleId);
    }

    function loadFavoriteButton(cmsGameId) {
        var wrap = $('#game-favorite-btn-wrap');
        if (!wrap) return;
        var cp = state.cmsProfile;
        if (!cp) return;
        var wpUserId = cp.wp_user_id || cp.id;
        if (!wpUserId) return;

        NovaAPI.checkFavorite(cmsGameId, wpUserId, function(err, data) {
            if (err || !wrap) return;
            var isFav = data && data.is_favorite;
            renderFavBtn(wrap, cmsGameId, wpUserId, isFav);
        });
    }

    function renderFavBtn(wrap, gameId, userId, isFav) {
        var heartFilled = '<svg viewBox="0 0 24 24" fill="var(--danger)" stroke="var(--danger)" stroke-width="2" width="22" height="22"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>';
        var heartEmpty = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="22" height="22"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>';
        wrap.innerHTML = '<button class="game-favorite-btn' + (isFav ? ' favorited' : '') + '" id="toggle-favorite-btn" title="' + (isFav ? 'Remover dos favoritos' : 'Adicionar aos favoritos') + '">' + (isFav ? heartFilled : heartEmpty) + '</button>';
        var btn = wrap.querySelector('#toggle-favorite-btn');
        if (btn) {
            btn.addEventListener('click', function() {
                btn.disabled = true;
                if (isFav) {
                    NovaAPI.removeFavorite(gameId, userId, function(err2) {
                        if (!err2) renderFavBtn(wrap, gameId, userId, false);
                        else btn.disabled = false;
                    });
                } else {
                    NovaAPI.addFavorite(gameId, userId, function(err2) {
                        if (!err2) renderFavBtn(wrap, gameId, userId, true);
                        else btn.disabled = false;
                    });
                }
            });
        }
    }

    function loadGameComments(titleId, gameTitle, page) {
        var section = $('#game-comments-section');
        if (!section) return;

        if (page === 1) {
            section.innerHTML = '<div class="loader-spinner" style="margin:16px auto"></div>';
        }

        NovaAPI.getGameComments(titleId, page, function(err, data) {
            if (!section) return;
            if (err || !data) {
                section.innerHTML = '<p style="color:var(--text-muted);font-size:13px;text-align:center;padding:16px">Não foi possível carregar comentários.</p>';
                return;
            }

            var comments = data.comments || [];
            var cmsProfile = NovaAPI.getCmsProfileData();
            var loggedIn = isCmsLoggedIn();

            var html = '';

            if (loggedIn) {
                html += '<div class="comment-form-wrap">' +
                    '<form id="comment-form" class="comment-form">' +
                        '<textarea id="comment-text" class="comment-textarea" placeholder="Escreva um comentário..." rows="3" maxlength="1000"></textarea>' +
                        '<div class="comment-form-actions">' +
                            '<span id="comment-char-count" class="comment-char-count">0/1000</span>' +
                            '<button type="submit" class="btn btn-primary btn-sm" id="comment-submit-btn">Enviar</button>' +
                        '</div>' +
                        '<p id="comment-error" class="comment-error hidden"></p>' +
                    '</form>' +
                '</div>';
            } else {
                html += '<div class="comment-login-prompt">' +
                    '<p>' + I18n.t('event_comment_login_hint') + '</p>' +
                '</div>';
            }

            if (comments.length === 0 && page === 1) {
                html += '<div class="comment-empty"><p>Nenhum comentário ainda. Seja o primeiro!</p></div>';
            } else {
                html += '<div class="comment-list" id="comment-list">';
                comments.forEach(function(c) {
                    html += renderCommentItem(c, cmsProfile);
                });
                html += '</div>';

                if (data.page < data.pages) {
                    html += '<div class="comment-load-more">' +
                        '<button class="btn btn-secondary btn-sm" id="comment-load-more" data-page="' + (data.page + 1) + '">Carregar mais</button>' +
                    '</div>';
                }
            }

            html += '<div class="comment-total" style="font-size:11px;color:var(--text-muted);text-align:center;margin-top:8px">' + (data.total || 0) + ' comentário(s)</div>';

            section.innerHTML = html;

            if (loggedIn) {
                var commentGame = state.selectedGame || findGameByTitleId(titleId);
                var commentArtUrl = commentGame ? getGameArt(commentGame) : '';
                bindCommentForm(titleId, gameTitle, commentArtUrl);
            }
            bindCommentActions(titleId, gameTitle);

            var loadMoreBtn = $('#comment-load-more');
            if (loadMoreBtn) {
                loadMoreBtn.addEventListener('click', function() {
                    var nextPage = parseInt(this.getAttribute('data-page'));
                    appendGameComments(titleId, gameTitle, nextPage);
                });
            }
        });
    }

    function appendGameComments(titleId, gameTitle, page) {
        var loadMoreBtn = $('#comment-load-more');
        if (loadMoreBtn) {
            loadMoreBtn.disabled = true;
            loadMoreBtn.textContent = 'Carregando...';
        }

        NovaAPI.getGameComments(titleId, page, function(err, data) {
            if (err || !data) return;
            var comments = data.comments || [];
            var cmsProfile = NovaAPI.getCmsProfileData();
            var list = $('#comment-list');
            if (!list) return;

            comments.forEach(function(c) {
                list.insertAdjacentHTML('beforeend', renderCommentItem(c, cmsProfile));
            });

            var loadMoreWrap = loadMoreBtn ? loadMoreBtn.parentElement : null;
            if (loadMoreWrap) {
                if (data.page < data.pages) {
                    loadMoreWrap.innerHTML = '<button class="btn btn-secondary btn-sm" id="comment-load-more" data-page="' + (data.page + 1) + '">Carregar mais</button>';
                    var newBtn = $('#comment-load-more');
                    if (newBtn) {
                        newBtn.addEventListener('click', function() {
                            appendGameComments(titleId, gameTitle, parseInt(this.getAttribute('data-page')));
                        });
                    }
                } else {
                    loadMoreWrap.remove();
                }
            }

            bindCommentActions(titleId, gameTitle);
        });
    }

    function renderCommentItem(c, cmsProfile) {
        var up = c.userProfile || {};
        var displayName = escapeHtml(up.display_name || up.username || 'Anônimo');
        var avatarInitial = (up.display_name || up.username || '?')[0].toUpperCase();
        var avatarHtml = up.avatar_url
            ? '<img class="comment-avatar" src="' + escapeHtml(up.avatar_url) + '" alt="" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'">' +
              '<div class="comment-avatar-fallback" style="display:none">' + escapeHtml(avatarInitial) + '</div>'
            : '<div class="comment-avatar-fallback">' + escapeHtml(avatarInitial) + '</div>';

        var dateStr = '';
        if (c.created_at) {
            try {
                var d = new Date(c.created_at);
                dateStr = d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            } catch(e) { dateStr = c.created_at; }
        }

        var deleteBtn = '';
        if (cmsProfile && up.id === cmsProfile.id) {
            deleteBtn = '<button class="comment-delete-btn" data-comment-id="' + c.id + '" title="Excluir">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>' +
            '</button>';
        }

        var authorTag = up.id
            ? '<a class="comment-author comment-author-link" data-profile-id="' + up.id + '" href="javascript:void(0)">' + displayName + '</a>'
            : '<span class="comment-author">' + displayName + '</span>';

        return '<div class="comment-item" data-comment-id="' + c.id + '">' +
            '<div class="comment-avatar-wrap">' + avatarHtml + '</div>' +
            '<div class="comment-body">' +
                '<div class="comment-header">' +
                    authorTag +
                    '<span class="comment-date">' + escapeHtml(dateStr) + '</span>' +
                    deleteBtn +
                '</div>' +
                '<div class="comment-text">' + escapeHtml(c.comment_text) + '</div>' +
            '</div>' +
        '</div>';
    }

    function bindCommentForm(titleId, gameTitle, coverArtUrl) {
        var form = $('#comment-form');
        if (!form) return;

        var textarea = $('#comment-text');
        var charCount = $('#comment-char-count');
        if (textarea && charCount) {
            textarea.addEventListener('input', function() {
                charCount.textContent = this.value.length + '/1000';
            });
        }

        form.addEventListener('submit', function(e) {
            e.preventDefault();
            var text = textarea.value.trim();
            var errorEl = $('#comment-error');
            var submitBtn = $('#comment-submit-btn');

            if (!text) {
                if (errorEl) { errorEl.textContent = 'Escreva algo antes de enviar.'; errorEl.classList.remove('hidden'); }
                return;
            }

            if (errorEl) errorEl.classList.add('hidden');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Enviando...';

            NovaAPI.addGameComment(titleId, text, gameTitle, function(err, comment) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Enviar';

                if (err) {
                    if (errorEl) { errorEl.textContent = err.message || 'Erro ao enviar comentário'; errorEl.classList.remove('hidden'); }
                    return;
                }

                textarea.value = '';
                if (charCount) charCount.textContent = '0/1000';
                loadGameComments(titleId, gameTitle, 1);
            }, coverArtUrl);
        });
    }

    function bindCommentActions(titleId, gameTitle) {
        document.querySelectorAll('.comment-delete-btn').forEach(function(btn) {
            btn.onclick = function() {
                var commentId = this.getAttribute('data-comment-id');
                if (!confirm('Excluir este comentário?')) return;
                var item = this.closest('.comment-item');
                if (item) item.style.opacity = '0.5';

                NovaAPI.deleteGameComment(titleId, commentId, function(err) {
                    if (err) {
                        if (item) item.style.opacity = '1';
                        return;
                    }
                    loadGameComments(titleId, gameTitle, 1);
                });
            };
        });
        document.querySelectorAll('.comment-author-link').forEach(function(link) {
            link.onclick = function(e) {
                e.preventDefault();
                var pid = parseInt(this.getAttribute('data-profile-id'));
                if (pid) showUserPublicProfile(pid);
            };
        });
    }

    function openGameScreenshot(url) {
        var viewer = $('#image-viewer');
        var img = $('#viewer-image');
        var dl = $('#viewer-download');
        var filename = 'game_screenshot.jpg';

        NovaAPI.loadAuthImage(url, img);
        dl.href = '#';
        dl.download = filename;
        dl.onclick = function(e) {
            e.preventDefault();
            NovaAPI.downloadAuthFile(url, filename);
        };
        show(viewer);
    }

    function getAchievementCacheKey(titleId) {
        return 'nova_ach_' + titleId.toLowerCase();
    }

    function loadCachedAchievements(titleId) {
        try {
            var data = localStorage.getItem(getAchievementCacheKey(titleId));
            if (data) return JSON.parse(data);
        } catch(e) {}
        return null;
    }

    function saveCachedAchievements(titleId, achList, unlocked) {
        try {
            localStorage.setItem(getAchievementCacheKey(titleId), JSON.stringify({
                achievements: achList,
                unlocked: unlocked,
                timestamp: Date.now()
            }));
        } catch(e) {}
    }

    function loadAchievements(titleId) {
        var section = $('#achievements-section');
        if (!section) return;

        var currentTid = getTitleIdFromState();
        var isRunning = currentTid && currentTid.toLowerCase() === titleId.toLowerCase();

        var cached = loadCachedAchievements(titleId);
        if (cached && cached.achievements && cached.achievements.length > 0 && !isRunning) {
            renderAchievements(section, cached.achievements, cached.unlocked || [], titleId);
            return;
        }

        if (!isRunning && (!cached || !cached.achievements || cached.achievements.length === 0)) {
            section.innerHTML = '<div class="section-title">Achievements</div>' +
                '<div class="card"><p style="color:var(--text-muted);font-size:13px">Inicie o jogo para carregar os achievements. Os dados serão salvos para visualização futura.</p></div>';
            return;
        }

        NovaAPI.getAchievements(titleId, function(err, achievements) {
            NovaAPI.getPlayerAchievements(titleId, function(err2, playerAch) {
                if (!section) return;

                var achList = [];
                if (achievements && achievements.length) achList = achievements;
                else if (achievements && achievements.Achievements) achList = achievements.Achievements;

                var unlocked = [];
                if (playerAch && playerAch.length) unlocked = playerAch;
                else if (playerAch && playerAch.Achievements) unlocked = playerAch.Achievements;

                if (achList.length === 0) {
                    section.innerHTML = '<div class="section-title">Achievements</div>' +
                        '<div class="card"><p style="color:var(--text-muted);font-size:13px">Inicie o jogo para carregar os achievements. Os dados serão salvos para visualização futura.</p></div>';
                    return;
                }

                saveCachedAchievements(titleId, achList, unlocked);
                renderAchievements(section, achList, unlocked, titleId);
                syncAchievementImagesToCms(achList, titleId);
            });
        });
    }

    var _autoRegisteredTids = {};
    var _batchInProgressTids = {};

    function autoRegisterGameIfNeeded(titleId, onDone) {
        if (!titleId || !state.isOnline || !isCmsLoggedIn()) { if (onDone) onDone(); return; }
        var cleanTid = titleId.replace(/^0x/i, '').toUpperCase();
        if (_autoRegisteredTids[cleanTid] || _batchInProgressTids[cleanTid]) { if (onDone) onDone(); return; }
        _autoRegisteredTids[cleanTid] = true;

        NovaAPI.cmsLookupGameByTitleId(cleanTid, function(err, data) {
            if (!err && data && data.game) {
                if (!data.game.cover_image) {
                    syncGameCoverToCms(cleanTid);
                }
                if (onDone) onDone();
                return;
            }

            var matchedGame = findGameByTitleId(titleId);
            var gameName = matchedGame ? getGameName(matchedGame) : '';
            if (!gameName && state.title) {
                gameName = state.title.Name || state.title.name || '';
            }
            if (!gameName) gameName = 'Unknown (' + cleanTid + ')';

            var gameType = matchedGame ? getGameType(matchedGame) : 1;
            var platformMap = { 1: 'xbox360', 2: 'arcade', 3: 'og_xbox', 5: 'homebrew' };
            var platform = platformMap[gameType] || 'xbox360';

            var artUrl = matchedGame ? getGameArt(matchedGame) : '';

            function doRegister(coverData) {
                var payload = { title_id: cleanTid, name: gameName, platform: platform };
                if (coverData) payload.cover_image_data = coverData;
                NovaAPI.autoRegisterGame(payload, function(regErr, resp) {
                    if (regErr) {
                        console.log('[AUTO-REG] Error:', regErr.message);
                    } else {
                        console.log('[AUTO-REG] Registered:', gameName, resp.created ? '(new)' : '(exists)');
                    }
                    if (onDone) onDone();
                });
            }

            if (artUrl) {
                NovaAPI.fetchImageAsBase64(artUrl, function(imgErr, base64) {
                    doRegister(base64 || null);
                });
            } else {
                doRegister(null);
            }
        });
    }

    function syncGameCoverToCms(titleId, callback) {
        var cleanTid = titleId.replace(/^0x/i, '').toUpperCase();
        var matchedGame = findGameByTitleId(titleId);
        if (!matchedGame) { if (callback) callback(false); return; }
        var artUrl = getGameArt(matchedGame);
        if (!artUrl) { if (callback) callback(false); return; }

        NovaAPI.fetchImageAsBase64(artUrl, function(err, base64) {
            if (!base64) { if (callback) callback(false); return; }
            NovaAPI.uploadGameCover({
                title_id: cleanTid,
                cover_image_data: base64
            }, function(err2) {
                if (err2) {
                    console.log('[COVER-SYNC] Error:', err2.message);
                    if (callback) callback(false);
                } else {
                    console.log('[COVER-SYNC] Uploaded cover for:', cleanTid);
                    if (callback) callback(true);
                }
            });
        });
    }

    var _batchRegisterRunning = false;

    function batchAutoRegisterGames() {
        if (_batchRegisterRunning || !state.isOnline || !isCmsLoggedIn()) return;
        if (!state.games || !state.games.length) return;
        _batchRegisterRunning = true;

        var queue = [];
        for (var i = 0; i < state.games.length; i++) {
            var g = state.games[i];
            var tid = getGameId(g);
            if (!tid) continue;
            var cleanTid = tid.replace(/^0x/i, '').toUpperCase();
            if (_autoRegisteredTids[cleanTid] || _batchInProgressTids[cleanTid]) continue;
            var artUrl = getGameArt(g);
            if (!artUrl) continue;
            _batchInProgressTids[cleanTid] = true;
            queue.push({ game: g, titleId: tid, cleanTid: cleanTid });
        }

        if (!queue.length) {
            _batchRegisterRunning = false;
            return;
        }

        var concurrency = 2;
        var index = 0;
        var completed = 0;
        var total = queue.length;
        var anyNewCovers = false;

        function processNext() {
            if (index >= total) return;
            var item = queue[index++];

            NovaAPI.cmsLookupGameByTitleId(item.cleanTid, function(err, data) {
                if (!err && data && data.game) {
                    _autoRegisteredTids[item.cleanTid] = true;
                    if (!data.game.cover_image) {
                        syncGameCoverToCms(item.titleId, function(uploaded) {
                            if (uploaded) anyNewCovers = true;
                            onItemDone(item);
                        });
                    } else {
                        onItemDone(item);
                    }
                    return;
                }

                var gameName = getGameName(item.game);
                if (!gameName) {
                    onItemDone(item);
                    return;
                }

                var gameType = getGameType(item.game);
                var platformMap = { 1: 'xbox360', 2: 'arcade', 3: 'og_xbox', 5: 'homebrew' };
                var platform = platformMap[gameType] || 'xbox360';
                var artUrl = getGameArt(item.game);

                if (artUrl) {
                    NovaAPI.fetchImageAsBase64(artUrl, function(imgErr, base64) {
                        NovaAPI.autoRegisterGame({
                            title_id: item.cleanTid,
                            name: gameName,
                            platform: platform,
                            cover_image_data: base64 || null
                        }, function(regErr, resp) {
                            if (!regErr) {
                                _autoRegisteredTids[item.cleanTid] = true;
                                anyNewCovers = true;
                                console.log('[BATCH-REG] Registered:', gameName, resp.created ? '(new)' : '(exists)');
                            } else {
                                console.log('[BATCH-REG] Error:', regErr.message);
                            }
                            onItemDone(item);
                        });
                    });
                } else {
                    NovaAPI.autoRegisterGame({
                        title_id: item.cleanTid,
                        name: gameName,
                        platform: platform
                    }, function(regErr, resp) {
                        if (!regErr) {
                            _autoRegisteredTids[item.cleanTid] = true;
                            console.log('[BATCH-REG] Registered:', gameName, resp.created ? '(new)' : '(exists)');
                        }
                        onItemDone(item);
                    });
                }
            });
        }

        function onItemDone(item) {
            completed++;
            if (item && !_autoRegisteredTids[item.cleanTid]) {
                delete _batchInProgressTids[item.cleanTid];
            }
            if (index < total) {
                processNext();
            }
            if (completed === total) {
                _batchRegisterRunning = false;
                _batchInProgressTids = {};
                console.log('[BATCH-REG] Completed. Processed', total, 'games.');
                if (anyNewCovers && state.currentPage === 'games') {
                    renderGames();
                }
            }
        }

        for (var c = 0; c < Math.min(concurrency, total); c++) {
            processNext();
        }
    }

    var _achImageSyncedKeys = {};

    function getAchSyncKey(titleId, achId) {
        return (titleId + '_' + achId).toUpperCase();
    }

    function syncAchievementImagesToCms(achList, titleId) {
        if (!state.isOnline || !isCmsLoggedIn()) return;

        var toUpload = [];
        var pending = 0;
        var total = 0;

        achList.forEach(function(a) {
            if (a.imageid == null || !titleId) return;
            var achId = a.id != null ? a.id : (a.AchievementId || a.Id);
            var syncKey = getAchSyncKey(titleId, achId);
            if (_achImageSyncedKeys[syncKey]) return;
            _achImageSyncedKeys[syncKey] = true;

            var imgUrl = NovaAPI.getAchievementImageUrl(titleId, a.imageid);
            if (!imgUrl) return;
            var achName = (a.strings && a.strings.caption) ? a.strings.caption : (a.Name || a.name || 'Achievement');
            var achDesc = (a.strings && a.strings.description) ? a.strings.description : (a.Description || a.description || '');
            var score = a.cred != null ? a.cred : (a.Gamerscore || a.gamerscore || 0);
            total++;

            NovaAPI.fetchImageAsBase64(imgUrl, function(err, base64) {
                pending++;
                if (base64) {
                    toUpload.push({
                        title_id: titleId,
                        achievement_id: String(achId),
                        name: achName,
                        description: achDesc,
                        gamerscore: score,
                        image_data: base64
                    });
                }
                if (pending >= total && toUpload.length > 0) {
                    var batchSize = 5;
                    var batches = [];
                    for (var i = 0; i < toUpload.length; i += batchSize) {
                        batches.push(toUpload.slice(i, i + batchSize));
                    }
                    (function sendBatch(idx) {
                        if (idx >= batches.length) {
                            console.log('[ACH-SYNC] Upload complete: ' + toUpload.length + ' images sent');
                            return;
                        }
                        NovaAPI.uploadAchievementImages(batches[idx], function(err) {
                            if (err) console.log('[ACH-SYNC] Batch error:', err.message);
                            sendBatch(idx + 1);
                        });
                    })(0);
                }
            });
        });
    }

    function renderAchievements(section, achList, unlocked, titleId) {
        var totalScore = 0, earnedScore = 0, earnedCount = 0;
        var unlockedIds = {};
        unlocked.forEach(function(u) {
            var uid = u.id != null ? u.id : (u.AchievementId || u.Id);
            if (uid == null) return;
            var isUnlocked = (u.player && u.player.length > 0) ? (u.player[0] !== 0) : true;
            if (isUnlocked) unlockedIds[uid] = true;
        });

        var processedList = [];
        achList.forEach(function(a) {
            var achId = a.id != null ? a.id : (a.AchievementId || a.Id);
            var score = a.cred != null ? a.cred : (a.Gamerscore || a.gamerscore || 0);
            var isUnlocked = !!unlockedIds[achId];
            var isHidden = a.hidden;
            var achName, achDesc;

            if (isHidden && !isUnlocked) {
                achName = 'Secret Achievement';
                achDesc = (a.strings && a.strings.unachieved) ? a.strings.unachieved : 'This is a secret achievement.';
            } else {
                achName = (a.strings && a.strings.caption) ? a.strings.caption : (a.Name || a.name || 'Achievement');
                achDesc = (a.strings && a.strings.description) ? a.strings.description : (a.Description || a.description || '');
            }

            var imgSrc = '';
            if (a.imageid != null && titleId) {
                imgSrc = NovaAPI.getAchievementImageUrl(titleId, a.imageid);
            } else {
                imgSrc = a.TileUrl || a.ImageUrl || '';
            }

            totalScore += score;
            if (isUnlocked) {
                earnedScore += score;
                earnedCount++;
            }

            var achType = a.type != null ? a.type : '';
            var achHidden = !!a.hidden;
            var typeIconMap = {1:'completion',2:'leveling',3:'unlock',4:'event',5:'tournament',6:'checkpoint'};
            var typeIcon = '';
            if (achHidden && !isUnlocked) {
                typeIcon = 'img/achievement.secret.png';
            } else if (achType && typeIconMap[achType]) {
                typeIcon = 'img/achievement.type.' + typeIconMap[achType] + '.png';
            } else if (achType) {
                typeIcon = 'img/achievement.type.other.png';
            }

            processedList.push({
                achId: achId,
                name: achName,
                desc: achDesc,
                score: score,
                imgSrc: imgSrc,
                imageid: a.imageid,
                unlocked: isUnlocked,
                typeIcon: typeIcon
            });
        });

        var pct = achList.length ? Math.round((earnedCount / achList.length) * 100) : 0;
        var circumference = 2 * Math.PI * 52;
        var offset = circumference - (pct / 100) * circumference;

        var harvestBtn = '';
        if (earnedCount > 0 && state.isOnline && isCmsLoggedIn() && state.cmsProfile) {
            harvestBtn = ' <button class="btn btn-sm btn-accent" id="harvest-ach-btn" title="Enviar conquistas desbloqueadas para seu perfil GodStix" style="margin-left:8px;font-size:11px;padding:2px 8px">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" style="vertical-align:-2px;margin-right:3px"><path d="M12 5v14M5 12l7 7 7-7"/></svg>Colher</button>';
        }

        var html = '<div class="section-title">Achievements <span class="badge badge-accent">' + earnedCount + '/' + achList.length + '</span>' + harvestBtn + '</div>' +
            '<div class="achievement-progress-center">' +
                '<svg class="progress-ring" viewBox="0 0 120 120"><circle class="bg" cx="60" cy="60" r="52"/><circle class="fill" cx="60" cy="60" r="52" stroke-dasharray="' + circumference + '" stroke-dashoffset="' + offset + '" transform="rotate(-90 60 60)"/></svg>' +
                '<div class="progress-text-inline"><div class="progress-value">' + earnedScore + 'G</div><div class="progress-label">of ' + totalScore + 'G</div></div>' +
            '</div>' +
            '<div class="achievement-filter">' +
                '<button class="btn btn-sm ach-filter-btn active" data-ach-filter="all">Todos</button>' +
                '<button class="btn btn-sm ach-filter-btn" data-ach-filter="locked">Faltando (' + (achList.length - earnedCount) + ')</button>' +
                '<button class="btn btn-sm ach-filter-btn" data-ach-filter="unlocked">Desbloqueados (' + earnedCount + ')</button>' +
                '<button class="btn btn-sm ach-overlay-toggle' + (getOverlayPref() ? ' active' : '') + '" id="ach-overlay-toggle" title="Mostrar/ocultar marcações">' +
                    '<svg class="ach-toggle-eye" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>' + (getOverlayPref() ? '' : '<line x1="2" y1="2" x2="22" y2="22" stroke="currentColor" stroke-width="2.5"/>') + '</svg>' +
                '</button>' +
            '</div>' +
            '<div class="achievement-list" id="ach-list-container">';

        processedList.forEach(function(item) {
            var achBgAttr = item.imgSrc ? 'data-ach-bg="' + escapeHtml(item.imgSrc) + '"' : '';
            var overlayImg = item.typeIcon ? '<img class="achievement-type-overlay" src="' + item.typeIcon + '" alt="">' : '';
            html += '<div class="achievement-item' + (item.unlocked ? ' achievement-unlocked' : ' achievement-locked') + '" data-ach-status="' + (item.unlocked ? 'unlocked' : 'locked') + '">' +
                '<div class="achievement-icon" ' + achBgAttr + '>' + overlayImg + '</div>' +
                '<div class="achievement-info">' +
                    '<div class="achievement-name">' + escapeHtml(item.name) + '</div>' +
                    '<div class="achievement-desc">' + escapeHtml(item.desc) + '</div>' +
                '</div>' +
                '<div class="achievement-score">' + item.score + 'G</div>' +
            '</div>';
        });

        html += '</div>';
        section.innerHTML = html;

        section.querySelectorAll('.achievement-icon[data-ach-bg]').forEach(function(div) {
            NovaAPI.loadAuthBackgroundImage(div.getAttribute('data-ach-bg'), div);
        });

        var achListContainer = section.querySelector('#ach-list-container');
        if (achListContainer) applyOverlayState(achListContainer);

        var overlayToggle = section.querySelector('#ach-overlay-toggle');
        if (overlayToggle) {
            overlayToggle.addEventListener('click', function() {
                var newVal = !getOverlayPref();
                setOverlayPref(newVal);
                this.classList.toggle('active', newVal);
                var eyeSvg = '<svg class="ach-toggle-eye" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>' + (newVal ? '' : '<line x1="2" y1="2" x2="22" y2="22" stroke="currentColor" stroke-width="2.5"/>') + '</svg>';
                this.innerHTML = eyeSvg;
                if (achListContainer) applyOverlayState(achListContainer);
            });
        }

        section.querySelectorAll('.ach-filter-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                section.querySelectorAll('.ach-filter-btn').forEach(function(b) { b.classList.remove('active'); });
                this.classList.add('active');
                var filter = this.getAttribute('data-ach-filter');
                section.querySelectorAll('.achievement-item').forEach(function(item) {
                    if (filter === 'all') {
                        item.style.display = '';
                    } else {
                        item.style.display = item.getAttribute('data-ach-status') === filter ? '' : 'none';
                    }
                });
            });
        });

        var harvestBtnEl = section.querySelector('#harvest-ach-btn');
        if (harvestBtnEl) {
            harvestBtnEl.addEventListener('click', function() {
                var btn = this;
                if (btn.disabled) return;

                var unlockedAchs = processedList.filter(function(item) { return item.unlocked; });
                if (unlockedAchs.length === 0) return;

                var achievementsToSend = unlockedAchs.map(function(item) {
                    return {
                        title_id: titleId,
                        achievement_id: String(item.achId),
                        name: item.name,
                        description: item.desc,
                        gamerscore: item.score,
                        image_url: item.imgSrc || ''
                    };
                });

                btn.disabled = true;
                btn.innerHTML = '<div class="loader-spinner small" style="display:inline-block;width:14px;height:14px;vertical-align:-2px;margin-right:3px"></div>Enviando...';

                NovaAPI.harvestAchievements(state.cmsProfile.id, achievementsToSend, function(err, result) {
                    if (err) {
                        btn.disabled = false;
                        btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" style="vertical-align:-2px;margin-right:3px"><path d="M12 5v14M5 12l7 7 7-7"/></svg>Colher';
                        alert('Erro: ' + err.message);
                        return;
                    }
                    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" style="vertical-align:-2px;margin-right:3px"><polyline points="20 6 9 17 4 12"/></svg>' +
                        (result.added > 0 ? result.added + ' nova(s)' : 'Já colhidas');
                    btn.style.opacity = '0.7';
                    setTimeout(function() {
                        btn.disabled = false;
                        btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" style="vertical-align:-2px;margin-right:3px"><path d="M12 5v14M5 12l7 7 7-7"/></svg>Colher';
                        btn.style.opacity = '';
                    }, 3000);
                    if (result.added > 0 && state.cmsProfile) {
                        state.cmsProfile.achievements_count = result.total;
                        NovaAPI.setCmsProfileData(state.cmsProfile);
                    }
                });
            });
        }
    }

    var roomsTab = 'public';
    var roomsData = null;
    var roomsMyData = null;
    var roomsLoading = false;
    var roomsDetailRoom = null;
    var roomsFriendIds = {};
    var roomsShowCreateForm = false;
    var roomsGameFilter = '';
    var roomsSearchQuery = '';
    var roomChatPollInterval = null;
    var roomChatLastId = 0;

    function getUserTimezone() {
        try {
            var saved = localStorage.getItem('nova_timezone');
            if (saved) return saved;
        } catch(e) {}
        return 'America/Sao_Paulo';
    }

    function setUserTimezone(tz) {
        try { localStorage.setItem('nova_timezone', tz); } catch(e) {}
    }

    var _intlTzSupported = null;
    function supportsIntlTimeZone() {
        if (_intlTzSupported !== null) return _intlTzSupported;
        try {
            new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
            _intlTzSupported = true;
        } catch(e) {
            _intlTzSupported = false;
        }
        return _intlTzSupported;
    }

    var tzOffsetMap = {
        'America/Noronha': -120,
        'America/Sao_Paulo': -180,
        'America/Manaus': -240,
        'America/Rio_Branco': -300,
        'America/New_York': -300,
        'America/Chicago': -360,
        'America/Denver': -420,
        'America/Los_Angeles': -480,
        'America/Mexico_City': -360,
        'America/Argentina/Buenos_Aires': -180,
        'Europe/London': 0,
        'Europe/Paris': 60,
        'Europe/Berlin': 60,
        'Europe/Moscow': 180,
        'Asia/Tokyo': 540,
        'Australia/Sydney': 600
    };

    function applyTzOffset(d, tz) {
        var offsetMin = tzOffsetMap[tz];
        if (offsetMin === undefined) offsetMin = -180;
        var utcMs = d.getTime() + d.getTimezoneOffset() * 60000;
        return new Date(utcMs + offsetMin * 60000);
    }

    function pad2(n) { return n < 10 ? '0' + n : '' + n; }

    function formatRoomTime(dateStr) {
        if (!dateStr) return '';
        var d = new Date(dateStr);
        if (isNaN(d.getTime())) return '';
        var tz = getUserTimezone();
        if (supportsIntlTimeZone()) {
            try {
                return d.toLocaleString('pt-BR', { timeZone: tz, day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
            } catch(e) {}
        }
        var local = applyTzOffset(d, tz);
        return pad2(local.getDate()) + '/' + pad2(local.getMonth() + 1) + '/' + String(local.getFullYear()).slice(2) + ' ' + pad2(local.getHours()) + ':' + pad2(local.getMinutes());
    }

    function formatRoomCountdown(dateStr) {
        if (!dateStr) return '';
        var now = Date.now();
        var target = new Date(dateStr).getTime();
        var diff = target - now;
        if (diff <= 0) return 'Agora';
        var hours = Math.floor(diff / 3600000);
        var mins = Math.floor((diff % 3600000) / 60000);
        if (hours > 24) {
            var days = Math.floor(hours / 24);
            return 'em ' + days + 'd ' + (hours % 24) + 'h';
        }
        if (hours > 0) return 'em ' + hours + 'h ' + mins + 'm';
        return 'em ' + mins + 'm';
    }

    function getRoomStatusBadge(status) {
        var map = {
            'scheduled': '<span class="badge badge-accent">Agendada</span>',
            'active': '<span class="badge badge-success">Ativa</span>',
            'finished': '<span class="badge" style="background:var(--bg-secondary);color:var(--text-muted)">Finalizada</span>',
            'cancelled': '<span class="badge" style="background:rgba(239,68,68,0.15);color:var(--danger)">Cancelada</span>'
        };
        return map[status] || '';
    }

    function getCmsProfileId() {
        var p = NovaAPI.getCmsProfileData();
        return p ? p.id : null;
    }

    function renderRoomCard(room) {
        var participants = room.participants || [];
        var activeCount = participants.filter(function(p) { return p.status === 'joined' || p.status === 'confirmed'; }).length;
        var creatorName = room.creator ? (room.creator.display_name || room.creator.username) : 'Unknown';
        var gameTitle = room.game_title || (room.game ? room.game.title : '');

        var avatarsHtml = '<div class="room-avatars">';
        var shown = 0;
        participants.forEach(function(p) {
            if ((p.status === 'joined' || p.status === 'confirmed') && shown < 4) {
                var up = p.userProfile || p.user_profile || {};
                var initial = ((up.display_name || up.username || '?')[0] || '?').toUpperCase();
                if (up.avatar_url) {
                    avatarsHtml += '<img class="room-avatar-thumb" src="' + escapeHtml(up.avatar_url) + '" alt="" onerror="this.style.display=\'none\'">';
                } else {
                    avatarsHtml += '<div class="room-avatar-thumb room-avatar-fallback">' + escapeHtml(initial) + '</div>';
                }
                shown++;
            }
        });
        if (activeCount > 4) {
            avatarsHtml += '<div class="room-avatar-thumb room-avatar-fallback">+' + (activeCount - 4) + '</div>';
        }
        avatarsHtml += '</div>';

        var timeInfo = '';
        if (room.scheduled_at) {
            timeInfo = '<div class="room-card-time">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12" style="vertical-align:-1px;margin-right:2px"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>' +
                formatRoomTime(room.scheduled_at, room.timezone) +
                '<span class="room-countdown">' + formatRoomCountdown(room.scheduled_at) + '</span>' +
            '</div>';
        }

        var serverBadge = room.server_type === 'stealth_server'
            ? '<span class="room-server-badge stealth">Stealth</span>'
            : '<span class="room-server-badge syslink">System Link</span>';

        var langBadge = '';
        if (room.language) {
            langBadge = '<span class="room-lang-badge room-lang-' + escapeHtml(room.language) + '">' + I18n.getLangFlag(room.language) + ' ' + I18n.getLangName(room.language) + '</span>';
        }

        return '<div class="room-card card" data-room-id="' + room.id + '">' +
            '<div class="room-card-header">' +
                '<div class="room-card-info">' +
                    '<div class="room-card-title">' + escapeHtml(room.title) + '</div>' +
                    (gameTitle ? '<div class="room-card-game">' + escapeHtml(gameTitle) + '</div>' : '') +
                '</div>' +
                '<div class="room-card-badges">' + langBadge + serverBadge + getRoomStatusBadge(room.status) + '</div>' +
            '</div>' +
            '<div class="room-card-meta">' +
                '<div class="room-card-host"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12" style="vertical-align:-1px;margin-right:2px"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>' + escapeHtml(creatorName) + '</div>' +
                '<div class="room-card-players">' + activeCount + '/' + (room.max_players || 4) + ' ' + I18n.t('rooms_players') + '</div>' +
            '</div>' +
            timeInfo +
            avatarsHtml +
        '</div>';
    }

    function renderProfile() {
        var el = $('#page-profile');
        if (!el) return;

        var loggedIn = isCmsLoggedIn();
        var cp = state.cmsProfile;

        var headerHtml = '<div class="page-header"><div><div class="page-title">' + I18n.t('profile_title') + '</div></div></div>';

        if (!state.isOnline) {
            el.innerHTML = headerHtml +
                '<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/></svg>' +
                '<p>Perfil indisponível offline</p></div>';
            return;
        }

        if (!loggedIn) {
            el.innerHTML = headerHtml +
                '<div class="empty-state">' +
                    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>' +
                    '<p>' + I18n.t('profile_not_logged') + '</p>' +
                '</div>';
            return;
        }

        var avatarInitial = (cp.display_name || cp.username || '?')[0].toUpperCase();
        var avatarHtml = cp.avatar_url
            ? '<img class="profile-page-avatar" src="' + escapeHtml(cp.avatar_url) + '" alt="" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'">' +
              '<div class="profile-page-avatar-fallback" style="display:none">' + escapeHtml(avatarInitial) + '</div>'
            : '<div class="profile-page-avatar-fallback">' + escapeHtml(avatarInitial) + '</div>';

        var pStats = state.cmsStats || cp;
        var friendsCount = 0;
        if (state.cmsFriendsList) friendsCount = state.cmsFriendsList.length;
        var downloadsCount = pStats.total_downloads || cp.total_downloads || 0;
        var achievementsCount = pStats.achievements_count || cp.achievements_count || 0;

        var coverUrl = cp.cover_url || '';
        var coverStyle = coverUrl ? 'background-image:url(' + escapeHtml(coverUrl) + ')' : '';

        var onlineBadge = cp.is_online
            ? '<span class="profile-badge-online"><span class="profile-online-indicator"></span>' + I18n.t('profile_online') + '</span>'
            : '';
        var levelBadge = cp.level_name
            ? '<span class="profile-badge-level">' + escapeHtml(cp.level_name) + '</span>'
            : '';

        var html = headerHtml;

        html += '<div class="profile-card-v2">' +
            '<div class="profile-card-cover" style="' + coverStyle + '">' +
                '<div class="profile-card-cover-overlay"></div>' +
                '<button class="profile-gear-btn" id="profile-gear-btn" title="' + I18n.t('profile_tab_settings') + '">' +
                    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>' +
                '</button>' +
                '<button class="profile-info-icon-btn" id="profile-info-btn" title="Xbox Profile Info">' +
                    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>' +
                '</button>' +
            '</div>' +
            '<div class="profile-card-body">' +
                '<div class="profile-card-avatar-wrap">' + avatarHtml + '</div>' +
                '<div class="profile-card-username-row">' +
                    '<span class="profile-card-username">' + escapeHtml(cp.display_name || cp.username) + '</span>' +
                    onlineBadge +
                '</div>' +
                '<div class="profile-card-code-row">' +
                    (cp.friend_code ? '<button class="profile-copy-code-btn" id="copy-friend-code-btn" title="' + I18n.t('profile_copy_code') + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> ' + escapeHtml(cp.friend_code) + '</button>' : '') +
                    levelBadge +
                '</div>' +
                '<div class="profile-card-stats">' +
                    '<div class="profile-card-stat">' +
                        '<div class="profile-card-stat-val">' + downloadsCount + '</div>' +
                        '<div class="profile-card-stat-lbl">' + I18n.t('profile_downloads') + '</div>' +
                    '</div>' +
                    '<div class="profile-card-stat">' +
                        '<div class="profile-card-stat-val">' + achievementsCount + '</div>' +
                        '<div class="profile-card-stat-lbl">' + I18n.t('profile_achievements') + '</div>' +
                    '</div>' +
                    '<div class="profile-card-stat">' +
                        '<div class="profile-card-stat-val" id="profile-friends-count">' + friendsCount + '</div>' +
                        '<div class="profile-card-stat-lbl">' + I18n.t('profile_friends') + '</div>' +
                    '</div>' +
                '</div>' +
            '</div>' +
            '<div class="profile-tabs">' +
                '<button class="profile-tab active" data-profile-tab="overview">' + I18n.t('profile_tab_overview') + '</button>' +
                '<button class="profile-tab" data-profile-tab="stats">' + I18n.t('profile_tab_stats') + '</button>' +
                '<button class="profile-tab" data-profile-tab="friends">' + I18n.t('profile_tab_friends') + '</button>' +
            '</div>' +
        '</div>';

        html += '<div class="profile-tab-content active" id="profile-tab-overview">';
        html += '<div class="profile-fav-section-title">' + I18n.t('profile_fav_games') + '</div>' +
            '<div id="profile-favorites-list"><div class="fm-loading"><div class="spinner"></div></div></div>';
        html += '<div class="section-title">' + I18n.t('profile_achievements_section') + '</div>' +
            '<div class="ach-subtabs">' +
                '<button class="ach-subtab active" data-ach-tab="xbox">' + I18n.t('ach_tab_xbox') + '</button>' +
                '<button class="ach-subtab" data-ach-tab="stix">' + I18n.t('ach_tab_stix') + '</button>' +
            '</div>' +
            '<div id="profile-xbox-achievements" class="ach-tab-content active"><div class="fm-loading"><div class="spinner"></div></div></div>' +
            '<div id="profile-stix-achievements" class="ach-tab-content" style="display:none"><div class="fm-loading"><div class="spinner"></div></div></div>';
        html += '</div>';

        html += '<div class="profile-tab-content" id="profile-tab-stats">';
        html += '<div class="section-title">' + I18n.t('profile_my_matches') + '</div>' +
            '<div class="partidas-filter-bar" id="partidas-filter-bar">' +
                '<button class="partidas-filter-btn active" data-partidas-filter="all">' + I18n.t('profile_filter_all') + '</button>' +
                '<button class="partidas-filter-btn" data-partidas-filter="day">' + I18n.t('profile_filter_day') + '</button>' +
                '<button class="partidas-filter-btn" data-partidas-filter="week">' + I18n.t('profile_filter_week') + '</button>' +
                '<button class="partidas-filter-btn" data-partidas-filter="month">' + I18n.t('profile_filter_month') + '</button>' +
                '<button class="partidas-filter-btn" data-partidas-filter="year">' + I18n.t('profile_filter_year') + '</button>' +
            '</div>' +
            '<div id="partidas-summary" class="partidas-summary"></div>' +
            '<div id="profile-gamestats-list"><div class="fm-loading"><div class="spinner"></div></div></div>';
        html += '</div>';

        html += '<div class="profile-tab-content" id="profile-tab-friends">';
        html += '<div class="section-title">' + I18n.t('profile_add_friend') + '</div>' +
            '<div class="card" style="padding:16px">' +
                '<div class="add-friend-form">' +
                    '<input type="text" id="friend-code-input" class="friend-code-input" placeholder="' + I18n.t('profile_friend_code_placeholder') + '" maxlength="7" style="text-transform:uppercase">' +
                    '<button class="btn btn-primary btn-sm" id="friend-code-search-btn">' + I18n.t('profile_friend_search') + '</button>' +
                '</div>' +
                '<div id="friend-code-result"></div>' +
            '</div>';
        html += '<div class="section-title">' + I18n.t('profile_friends_title') + '</div>' +
            '<div class="friends-filter-bar">' +
                '<button class="friends-filter-btn active" data-friends-filter="all">' + I18n.t('profile_friends_all') + '</button>' +
                '<button class="friends-filter-btn" data-friends-filter="online">' + I18n.t('profile_friends_online') + '</button>' +
            '</div>' +
            '<div id="profile-friends-list"><div class="fm-loading"><div class="spinner"></div></div></div>';
        html += '<div class="section-title">' + I18n.t('profile_pending_requests') + '</div>' +
            '<div id="profile-pending-requests"></div>';
        html += '</div>';

        html += '<div class="profile-tab-content" id="profile-tab-settings">';
        var langOptions = '';
        I18n.getLanguages().forEach(function(l) {
            langOptions += '<option value="' + l.code + '"' + (I18n.getLanguage() === l.code ? ' selected' : '') + '>' + l.flag + ' ' + l.name + '</option>';
        });
        var settingsAvatarInitial = (cp.display_name || cp.username || '?')[0].toUpperCase();
        html += '<div class="settings-section-label">' + I18n.t('profile_settings_account') + '</div>' +
            '<div class="settings-card-v2">' +
                '<div class="settings-account-row">' +
                    '<div class="settings-account-avatar">' +
                        (cp.avatar_url ? '<img src="' + escapeHtml(cp.avatar_url) + '" alt="" class="settings-account-img" id="settings-account-img">' : '<div class="settings-account-fallback">' + escapeHtml(settingsAvatarInitial) + '</div>') +
                    '</div>' +
                    '<div class="settings-account-info">' +
                        '<div class="settings-account-name">' + escapeHtml(cp.display_name || cp.username) + '</div>' +
                        '<div class="settings-account-email">' + escapeHtml(cp.email || '') + '</div>' +
                    '</div>' +
                    '<button class="settings-edit-btn" id="avatar-upload-btn">' + I18n.t('profile_settings_edit') + '</button>' +
                    '<input type="file" id="avatar-upload-input" accept="image/jpeg,image/png,image/webp" style="display:none">' +
                '</div>' +
                '<div id="avatar-upload-status" class="avatar-upload-status" style="padding:0 16px 12px"></div>' +
            '</div>' +
            '<div class="settings-card-v2">' +
                '<div class="settings-row-item">' +
                    '<span>' + I18n.t('profile_settings_subscription') + '</span>' +
                    '<span class="settings-row-value">' + (cp.level_name ? '<span class="profile-badge-level" style="font-size:11px;padding:2px 10px">' + escapeHtml(cp.level_name) + '</span>' : '-') + '</span>' +
                '</div>' +
            '</div>' +
            '<div class="settings-section-label">' + I18n.t('profile_settings_preferences') + '</div>' +
            '<div class="settings-card-v2">' +
                '<div class="settings-row-item">' +
                    '<span>' + I18n.t('settings_language') + '</span>' +
                    '<select id="settings-language" class="settings-inline-select">' + langOptions + '</select>' +
                '</div>' +
            '</div>' +
            '<div class="settings-card-v2">' +
                '<div class="settings-toggle-row">' +
                    '<label class="settings-toggle-label">' +
                        '<input type="checkbox" id="settings-privacy-achievements"' + (cp.privacy_achievements ? ' checked' : '') + '>' +
                        '<span>' + I18n.t('settings_hide_achievements') + '</span>' +
                    '</label>' +
                '</div>' +
                '<div class="settings-toggle-row" style="margin-bottom:0">' +
                    '<label class="settings-toggle-label">' +
                        '<input type="checkbox" id="settings-privacy-playtime"' + (cp.privacy_playtime ? ' checked' : '') + '>' +
                        '<span>' + I18n.t('settings_hide_playtime') + '</span>' +
                    '</label>' +
                '</div>' +
            '</div>' +
            '<div class="settings-card-v2">' +
                '<div class="settings-field-v2">' +
                    '<label for="settings-bio">' + I18n.t('settings_bio_label') + ' <span class="settings-hint">' + I18n.t('settings_bio_hint') + '</span></label>' +
                    '<textarea id="settings-bio" class="settings-input settings-textarea" maxlength="250" placeholder="' + I18n.t('settings_bio_placeholder') + '">' + escapeHtml(cp.bio || '') + '</textarea>' +
                    '<div class="settings-char-count"><span id="settings-bio-count">' + (cp.bio ? cp.bio.length : 0) + '</span>/250</div>' +
                '</div>' +
                '<div class="settings-field-v2">' +
                    '<label for="settings-birthdate">' + I18n.t('settings_birthdate') + '</label>' +
                    '<input type="date" id="settings-birthdate" class="settings-input" value="' + escapeHtml(cp.birth_date || '') + '">' +
                '</div>' +
                '<div class="settings-field-v2">' +
                    '<label>' + I18n.t('settings_custom_link') + '</label>' +
                    '<div class="settings-link-row">' +
                        '<input type="text" id="settings-link-title" class="settings-input settings-link-title" maxlength="10" placeholder="' + I18n.t('settings_link_title_placeholder') + '" value="' + escapeHtml(cp.custom_link_title || '') + '">' +
                        '<input type="url" id="settings-link-url" class="settings-input settings-link-url" placeholder="' + I18n.t('settings_link_url_placeholder') + '" value="' + escapeHtml(cp.custom_link_url || '') + '">' +
                    '</div>' +
                '</div>' +
            '</div>' +
            '<div class="settings-card-v2">' +
                '<div class="settings-field-v2">' +
                    '<label>' + I18n.t('profile_cover_upload_label') + '</label>' +
                    '<div class="cover-upload-area">' +
                        '<div class="cover-upload-preview" id="cover-upload-preview">' +
                            (coverUrl ? '<img src="' + escapeHtml(coverUrl) + '" alt="" class="cover-upload-img">' : '<div class="cover-upload-placeholder"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="24" height="24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg></div>') +
                        '</div>' +
                        '<button class="btn btn-secondary cover-upload-btn" id="cover-upload-btn">' + I18n.t('profile_cover_upload_btn') + '</button>' +
                        '<input type="file" id="cover-upload-input" accept="image/jpeg,image/png,image/webp" style="display:none">' +
                        '<div class="cover-upload-status" id="cover-upload-status"></div>' +
                    '</div>' +
                '</div>' +
            '</div>' +
            '<button class="btn btn-primary settings-save-btn-v2" id="save-profile-settings-btn">' + I18n.t('settings_save') + '</button>' +
            '<div id="settings-save-status" class="settings-save-status"></div>';
        html += '</div>';

        el.innerHTML = html;

        el.querySelectorAll('.profile-tab').forEach(function(tabBtn) {
            tabBtn.addEventListener('click', function() {
                el.querySelectorAll('.profile-tab').forEach(function(t) { t.classList.remove('active'); });
                el.querySelectorAll('.profile-tab-content').forEach(function(c) { c.classList.remove('active'); });
                tabBtn.classList.add('active');
                var tabId = 'profile-tab-' + tabBtn.getAttribute('data-profile-tab');
                var tabContent = el.querySelector('#' + tabId);
                if (tabContent) tabContent.classList.add('active');
            });
        });

        var gearBtn = el.querySelector('#profile-gear-btn');
        if (gearBtn) {
            gearBtn.addEventListener('click', function() {
                el.querySelectorAll('.profile-tab').forEach(function(t) { t.classList.remove('active'); });
                el.querySelectorAll('.profile-tab-content').forEach(function(c) { c.classList.remove('active'); });
                var settingsContent = el.querySelector('#profile-tab-settings');
                if (settingsContent) settingsContent.classList.add('active');
            });
        }

        var copyBtn = el.querySelector('#copy-friend-code-btn');
        if (copyBtn) {
            copyBtn.addEventListener('click', function() {
                var code = cp.friend_code;
                if (navigator.clipboard) {
                    navigator.clipboard.writeText(code).then(function() {
                        copyBtn.title = 'Copiado!';
                        setTimeout(function() { copyBtn.title = 'Copiar código de amigo'; }, 2000);
                    });
                } else {
                    var ta = document.createElement('textarea');
                    ta.value = code;
                    document.body.appendChild(ta);
                    ta.select();
                    document.execCommand('copy');
                    document.body.removeChild(ta);
                    copyBtn.title = 'Copiado!';
                    setTimeout(function() { copyBtn.title = 'Copiar código de amigo'; }, 2000);
                }
            });
        }

        var infoBtn = el.querySelector('#profile-info-btn');
        if (infoBtn) {
            infoBtn.addEventListener('click', function() {
                var popupContent = '';
                if (cp.friend_code) {
                    popupContent += '<div class="profile-info-popup-section">' +
                        '<div class="friend-code-label">Seu Código de Amigo</div>' +
                        '<div class="friend-code-value">' + escapeHtml(cp.friend_code) + '</div>' +
                        '<div class="friend-code-hint">Compartilhe este código para seus amigos te adicionarem</div>' +
                        '<button class="btn btn-primary btn-sm" id="popup-copy-code-btn" style="margin-top:12px">Copiar Código</button>' +
                    '</div>';
                } else {
                    popupContent += '<div class="profile-info-popup-section">' +
                        '<p style="font-size:13px;color:var(--text-secondary);margin-bottom:12px">Selecione seu perfil Xbox principal para gerar seu código de amigo (últimos 7 dígitos do XUID).</p>' +
                        '<div id="popup-xbox-selector"></div>' +
                    '</div>';
                }
                popupContent += '<div class="profile-info-popup-section">' +
                    '<div class="friend-code-label">Compartilhar Perfil</div>' +
                    '<div class="friend-code-hint">Compartilhe seu código de amigo com outros jogadores para que eles possam te encontrar e adicionar.</div>' +
                '</div>';

                var overlay = document.createElement('div');
                overlay.className = 'profile-info-popup-overlay';
                overlay.innerHTML = '<div class="profile-info-popup">' +
                    '<div class="profile-info-popup-header">' +
                        '<div class="profile-info-popup-title">Perfil Xbox</div>' +
                        '<button class="profile-info-popup-close" id="profile-info-popup-close">&times;</button>' +
                    '</div>' +
                    '<div class="profile-info-popup-body">' + popupContent + '</div>' +
                '</div>';
                document.body.appendChild(overlay);

                overlay.querySelector('#profile-info-popup-close').addEventListener('click', function() {
                    overlay.remove();
                });
                overlay.addEventListener('click', function(e) {
                    if (e.target === overlay) overlay.remove();
                });

                var popupCopyBtn = overlay.querySelector('#popup-copy-code-btn');
                if (popupCopyBtn && cp.friend_code) {
                    popupCopyBtn.addEventListener('click', function() {
                        if (navigator.clipboard) {
                            navigator.clipboard.writeText(cp.friend_code).then(function() {
                                popupCopyBtn.textContent = 'Copiado!';
                                setTimeout(function() { popupCopyBtn.textContent = 'Copiar Código'; }, 2000);
                            });
                        } else {
                            var ta = document.createElement('textarea');
                            ta.value = cp.friend_code;
                            document.body.appendChild(ta);
                            ta.select();
                            document.execCommand('copy');
                            document.body.removeChild(ta);
                            popupCopyBtn.textContent = 'Copiado!';
                            setTimeout(function() { popupCopyBtn.textContent = 'Copiar Código'; }, 2000);
                        }
                    });
                }

                if (!cp.friend_code) {
                    var selectorContainer = overlay.querySelector('#popup-xbox-selector');
                    if (selectorContainer) {
                        loadXboxProfileSelectorInto(selectorContainer);
                    }
                }
            });
        }

        var bioTextarea = el.querySelector('#settings-bio');
        var bioCount = el.querySelector('#settings-bio-count');
        if (bioTextarea && bioCount) {
            bioTextarea.addEventListener('input', function() {
                bioCount.textContent = bioTextarea.value.length;
            });
        }

        var avatarUploadBtn = el.querySelector('#avatar-upload-btn');
        var avatarUploadInput = el.querySelector('#avatar-upload-input');
        if (avatarUploadBtn && avatarUploadInput) {
            avatarUploadBtn.addEventListener('click', function() {
                avatarUploadInput.click();
            });
            avatarUploadInput.addEventListener('change', function() {
                var file = this.files[0];
                if (!file) return;
                var statusEl = el.querySelector('#avatar-upload-status');
                var allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
                if (allowedTypes.indexOf(file.type) === -1) {
                    if (statusEl) { statusEl.textContent = I18n.t('avatar_upload_type_error'); statusEl.className = 'avatar-upload-status error'; }
                    return;
                }
                if (file.size > 2 * 1024 * 1024) {
                    if (statusEl) { statusEl.textContent = I18n.t('avatar_upload_size_error'); statusEl.className = 'avatar-upload-status error'; }
                    return;
                }
                avatarUploadBtn.disabled = true;
                avatarUploadBtn.textContent = I18n.t('avatar_uploading');
                if (statusEl) { statusEl.textContent = ''; statusEl.className = 'avatar-upload-status'; }
                NovaAPI.uploadAvatar(cp.id, file, function(err, resp) {
                    avatarUploadBtn.disabled = false;
                    avatarUploadBtn.textContent = I18n.t('profile_settings_edit');
                    if (err) {
                        if (statusEl) { statusEl.textContent = I18n.t('avatar_upload_error'); statusEl.className = 'avatar-upload-status error'; }
                        return;
                    }
                    if (resp && resp.avatar_url) {
                        var newUrl = resp.avatar_url;
                        if (state.cmsProfile) {
                            state.cmsProfile.avatar_url = newUrl;
                            NovaAPI.setCmsProfileData(state.cmsProfile);
                        }
                        var profilePageAvatar = document.querySelector('.profile-page-avatar');
                        if (profilePageAvatar) {
                            profilePageAvatar.src = newUrl;
                            profilePageAvatar.style.display = '';
                            var fallback = profilePageAvatar.nextElementSibling;
                            if (fallback && fallback.classList.contains('profile-page-avatar-fallback')) {
                                fallback.style.display = 'none';
                            }
                        } else {
                            var fallbackEl = document.querySelector('.profile-page-avatar-fallback');
                            if (fallbackEl && fallbackEl.parentElement) {
                                var img = document.createElement('img');
                                img.className = 'profile-page-avatar';
                                img.src = newUrl;
                                img.alt = '';
                                fallbackEl.parentElement.insertBefore(img, fallbackEl);
                                fallbackEl.style.display = 'none';
                            }
                        }
                        var cmsAvatar = document.querySelector('.cms-profile-avatar');
                        if (cmsAvatar) {
                            cmsAvatar.src = newUrl;
                            cmsAvatar.style.display = '';
                            var cmsFallback = cmsAvatar.nextElementSibling;
                            if (cmsFallback && cmsFallback.classList.contains('cms-profile-avatar-fallback')) {
                                cmsFallback.style.display = 'none';
                            }
                        }
                        var headerAvatar = document.querySelector('.header-avatar-img');
                        if (headerAvatar) headerAvatar.src = newUrl;
                        var settingsAccountImg = document.querySelector('#settings-account-img');
                        if (settingsAccountImg) {
                            settingsAccountImg.src = newUrl;
                        } else {
                            var settingsAvatarWrap = document.querySelector('.settings-account-avatar');
                            if (settingsAvatarWrap) {
                                var existingFallback = settingsAvatarWrap.querySelector('.settings-account-fallback');
                                if (existingFallback) {
                                    var newImg = document.createElement('img');
                                    newImg.id = 'settings-account-img';
                                    newImg.className = 'settings-account-img';
                                    newImg.src = newUrl;
                                    newImg.alt = '';
                                    settingsAvatarWrap.replaceChild(newImg, existingFallback);
                                }
                            }
                        }
                        if (statusEl) { statusEl.textContent = I18n.t('avatar_upload_success'); statusEl.className = 'avatar-upload-status success'; }
                        setTimeout(function() { if (statusEl) statusEl.textContent = ''; }, 3000);
                    }
                });
            });
        }

        var coverUploadBtn = el.querySelector('#cover-upload-btn');
        var coverUploadInput = el.querySelector('#cover-upload-input');
        if (coverUploadBtn && coverUploadInput) {
            coverUploadBtn.addEventListener('click', function() {
                coverUploadInput.click();
            });
            coverUploadInput.addEventListener('change', function() {
                var file = this.files[0];
                if (!file) return;
                var coverStatusEl = el.querySelector('#cover-upload-status');
                var allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
                if (allowedTypes.indexOf(file.type) === -1) {
                    if (coverStatusEl) { coverStatusEl.textContent = I18n.t('avatar_upload_type_error'); coverStatusEl.className = 'cover-upload-status error'; }
                    return;
                }
                if (file.size > 2 * 1024 * 1024) {
                    if (coverStatusEl) { coverStatusEl.textContent = I18n.t('avatar_upload_size_error'); coverStatusEl.className = 'cover-upload-status error'; }
                    return;
                }
                coverUploadBtn.disabled = true;
                coverUploadBtn.textContent = I18n.t('avatar_uploading');
                if (coverStatusEl) { coverStatusEl.textContent = ''; coverStatusEl.className = 'cover-upload-status'; }
                NovaAPI.uploadCover(cp.id, file, function(err, resp) {
                    coverUploadBtn.disabled = false;
                    coverUploadBtn.textContent = I18n.t('profile_cover_upload_btn');
                    if (err) {
                        if (coverStatusEl) { coverStatusEl.textContent = I18n.t('avatar_upload_error'); coverStatusEl.className = 'cover-upload-status error'; }
                        return;
                    }
                    if (resp && resp.cover_url) {
                        var newCoverUrl = resp.cover_url;
                        if (state.cmsProfile) {
                            state.cmsProfile.cover_url = newCoverUrl;
                            NovaAPI.setCmsProfileData(state.cmsProfile);
                        }
                        var coverEl = document.querySelector('.profile-card-cover');
                        if (coverEl) coverEl.style.backgroundImage = 'url(' + newCoverUrl + ')';
                        var coverPreview = el.querySelector('#cover-upload-preview');
                        if (coverPreview) {
                            coverPreview.innerHTML = '<img src="' + escapeHtml(newCoverUrl) + '" alt="" class="cover-upload-img">';
                        }
                        if (coverStatusEl) { coverStatusEl.textContent = I18n.t('profile_cover_upload_success'); coverStatusEl.className = 'cover-upload-status success'; }
                        setTimeout(function() { if (coverStatusEl) coverStatusEl.textContent = ''; }, 3000);
                    }
                });
            });
        }

        var settingsLangSelect = el.querySelector('#settings-language');
        if (settingsLangSelect) {
            settingsLangSelect.addEventListener('change', function() {
                I18n.setLanguage(this.value);
                updateNavLanguage();
                renderProfile();
                var gearBtnAfter = document.querySelector('#profile-gear-btn');
                if (gearBtnAfter) gearBtnAfter.click();
            });
        }

        var saveSettingsBtn = el.querySelector('#save-profile-settings-btn');
        if (saveSettingsBtn) {
            saveSettingsBtn.addEventListener('click', function() {
                saveSettingsBtn.disabled = true;
                saveSettingsBtn.textContent = I18n.t('settings_saving');
                var statusEl = el.querySelector('#settings-save-status');
                var bioVal = (el.querySelector('#settings-bio') || {}).value || '';
                bioVal = bioVal.replace(/\n/g, '<br>');
                var birthVal = (el.querySelector('#settings-birthdate') || {}).value || '';
                var linkTitle = (el.querySelector('#settings-link-title') || {}).value || '';
                var linkUrl = (el.querySelector('#settings-link-url') || {}).value || '';
                var privAch = !!(el.querySelector('#settings-privacy-achievements') || {}).checked;
                var privPt = !!(el.querySelector('#settings-privacy-playtime') || {}).checked;

                NovaAPI.cmsUpdateProfile(cp.id, {
                    bio: bioVal,
                    birth_date: birthVal || null,
                    custom_link_title: linkTitle || null,
                    custom_link_url: linkUrl || null,
                    privacy_achievements: privAch,
                    privacy_playtime: privPt
                }, function(err, resp) {
                    saveSettingsBtn.disabled = false;
                    saveSettingsBtn.textContent = I18n.t('settings_save');
                    if (err) {
                        if (statusEl) { statusEl.textContent = I18n.t('settings_error'); statusEl.className = 'settings-save-status error'; }
                    } else {
                        if (statusEl) { statusEl.textContent = I18n.t('settings_saved'); statusEl.className = 'settings-save-status success'; }
                        if (resp && resp.profile) {
                            state.cmsProfile = Object.assign(state.cmsProfile, resp.profile);
                        }
                        setTimeout(function() { if (statusEl) statusEl.textContent = ''; }, 3000);
                    }
                });
            });
        }

        bindFriendCodeSearch();
        loadFriendsList();
        loadProfileFavorites();
        loadProfileXboxAchievements();
        loadProfileStixAchievements();
        loadProfileGameStats('all');
        bindPartidasFilter();
        bindAchSubtabs();
    }

    function loadProfileXboxAchievements() {
        var container = $('#profile-xbox-achievements');
        if (!container) return;
        var cp = state.cmsProfile;
        if (!cp || !cp.id) {
            container.innerHTML = '<div class="card" style="padding:12px;font-size:13px;color:var(--text-muted);text-align:center">' + I18n.t('ach_login_required') + '</div>';
            return;
        }
        NovaAPI.getUserAchievements(cp.id, function(err, data) {
            if (err || !data) {
                container.innerHTML = '<div class="card" style="padding:12px;font-size:13px;color:var(--text-muted);text-align:center">' + I18n.t('ach_load_error') + '</div>';
                return;
            }
            var allAchs = data.achievements || [];
            var xboxAchs = allAchs.filter(function(a) {
                return a.achievement_key && a.achievement_key.indexOf('xbox_') === 0;
            });
            if (xboxAchs.length === 0) {
                container.innerHTML = '<div class="card" style="padding:12px;font-size:13px;color:var(--text-muted);text-align:center">' + I18n.t('ach_no_xbox') + '</div>';
                return;
            }
            var groups = {};
            xboxAchs.forEach(function(a) {
                var parts = (a.achievement_key || '').split('_');
                var gameTid = parts.length >= 3 ? parts[1] : 'unknown';
                gameTid = gameTid.replace(/^0x/i, '').toUpperCase();
                if (!groups[gameTid]) groups[gameTid] = [];
                groups[gameTid].push(a);
            });
            var gameKeys = Object.keys(groups);
            var resolved = 0;
            var gameInfoMap = {};
            var achievementCounts = {};

            function renderGameCards() {
                var html = '';
                gameKeys.forEach(function(tid) {
                    var items = groups[tid];
                    var info = gameInfoMap[tid] || {};
                    var gameName = info.name || ('Title ID: ' + tid);
                    var coverImg = info.cover_image || '';
                    var totalCount = achievementCounts[tid] || items.length;
                    var unlockedCount = items.length;
                    var cmsBase = NovaAPI.getCmsUrl ? NovaAPI.getCmsUrl() : '';

                    var artHtml = '';
                    if (coverImg) {
                        var coverSrc = coverImg;
                        if (coverSrc.indexOf('/') === 0 && cmsBase) coverSrc = cmsBase + coverSrc;
                        artHtml = '<img class="pxa-game-art" src="' + escapeHtml(coverSrc) + '" alt="" onerror="this.onerror=null;this.src=\'img/noboxart.svg\'">';
                    } else {
                        artHtml = '<img class="pxa-game-art" src="img/noboxart.svg" alt="">';
                    }

                    var pxaDeleteBtn = '';
                    pxaDeleteBtn = '<button class="pxa-delete-btn" data-pxa-del-tid="' + escapeHtml(tid) + '" title="' + (I18n.t('delete') || 'Excluir') + '">' +
                        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>' +
                    '</button>';

                    html += '<div class="pxa-game-card card" data-pxa-tid="' + escapeHtml(tid) + '">' +
                        '<div class="pxa-game-header">' +
                            artHtml +
                            '<div class="pxa-game-info">' +
                                '<div class="pxa-game-name">' + escapeHtml(gameName) + '</div>' +
                                '<div class="pxa-game-count">' + unlockedCount + '/' + totalCount + ' ' + I18n.t('ach_count_label') + '</div>' +
                            '</div>' +
                            pxaDeleteBtn +
                            '<div class="pxa-game-chevron"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polyline points="6 9 12 15 18 9"/></svg></div>' +
                        '</div>' +
                        '<div class="pxa-ach-list" style="display:none">';

                    items.forEach(function(a) {
                        var iconSrc = a.icon || '';
                        if (iconSrc && iconSrc.indexOf('/') === 0 && cmsBase) iconSrc = cmsBase + iconSrc;
                        var iconHtml = '';
                        if (iconSrc && iconSrc.length > 0) {
                            iconHtml = '<img class="pxa-ach-icon" src="' + escapeHtml(iconSrc) + '" alt="" onerror="this.onerror=null;this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'">' +
                                '<div class="pxa-ach-icon-fallback" style="display:none">🏆</div>';
                        } else {
                            iconHtml = '<div class="pxa-ach-icon-fallback">🏆</div>';
                        }
                        var dateStr = '';
                        if (a.unlocked_at) {
                            try { dateStr = new Date(a.unlocked_at).toLocaleDateString(I18n.getDateLocale()); } catch(e) {}
                        }
                        html += '<div class="pxa-ach-item">' +
                            '<div class="pxa-ach-icon-wrap">' + iconHtml + '</div>' +
                            '<div class="pxa-ach-info">' +
                                '<div class="pxa-ach-name">' + escapeHtml(a.achievement_name || '') + '</div>' +
                                '<div class="pxa-ach-desc">' + escapeHtml(a.achievement_description || '') +
                                    (dateStr ? ' <span class="pxa-ach-date">' + dateStr + '</span>' : '') +
                                '</div>' +
                            '</div>' +
                        '</div>';
                    });

                    html += '</div></div>';
                });
                container.innerHTML = html;

                container.querySelectorAll('.pxa-game-card').forEach(function(card) {
                    card.querySelector('.pxa-game-header').addEventListener('click', function() {
                        var list = card.querySelector('.pxa-ach-list');
                        var chevron = card.querySelector('.pxa-game-chevron');
                        if (list.style.display === 'none') {
                            list.style.display = '';
                            chevron.classList.add('open');
                        } else {
                            list.style.display = 'none';
                            chevron.classList.remove('open');
                        }
                    });
                });

                container.querySelectorAll('.pxa-delete-btn').forEach(function(btn) {
                    btn.addEventListener('click', function(e) {
                        e.stopPropagation();
                        var tid = btn.getAttribute('data-pxa-del-tid');
                        showConfirmDialog(I18n.t('profile_delete_game_achievements_confirm') || 'Deseja apagar todas as conquistas deste jogo?', function() {
                            btn.disabled = true;
                            btn.style.opacity = '0.3';
                            NovaAPI.deleteGameAchievements(cp.id, tid, function(delErr, delResp) {
                                if (delErr) {
                                    btn.disabled = false;
                                    btn.style.opacity = '';
                                    showToast(I18n.t('error') || 'Erro');
                                    return;
                                }
                                var cardEl = container.querySelector('[data-pxa-tid="' + tid + '"]');
                                if (cardEl) cardEl.remove();
                                if (delResp && delResp.achievements_count !== undefined) {
                                    var statEls = document.querySelectorAll('.profile-card-stat');
                                    statEls.forEach(function(s) {
                                        var lbl = s.querySelector('.profile-card-stat-lbl');
                                        if (lbl && lbl.textContent === I18n.t('profile_achievements')) {
                                            var valEl = s.querySelector('.profile-card-stat-val');
                                            if (valEl) valEl.textContent = delResp.achievements_count;
                                        }
                                    });
                                }
                                showToast(I18n.t('profile_achievements_removed'));
                            });
                        });
                    });
                });
            }

            gameKeys.forEach(function(tid) {
                NovaAPI.cmsLookupGameByTitleId(tid, function(err, data) {
                    if (!err && data && data.game) {
                        gameInfoMap[tid] = { name: data.game.title || ('Title ' + tid), cover_image: data.game.cover_image || '' };
                    } else {
                        gameInfoMap[tid] = { name: 'Title ID: ' + tid, cover_image: '' };
                    }
                    resolved++;
                    if (resolved === gameKeys.length) {
                        NovaAPI.cmsGetAchievementCounts(gameKeys, function(err2, resp) {
                            if (!err2 && resp && resp.counts) {
                                achievementCounts = resp.counts;
                            }
                            renderGameCards();
                        });
                    }
                });
            });
            if (gameKeys.length === 0) renderGameCards();
        });
    }

    function bindAchSubtabs() {
        var subtabs = document.querySelectorAll('.ach-subtab');
        subtabs.forEach(function(tab) {
            tab.addEventListener('click', function() {
                var target = tab.getAttribute('data-ach-tab');
                subtabs.forEach(function(t) { t.classList.remove('active'); });
                tab.classList.add('active');
                var xboxPanel = $('#profile-xbox-achievements');
                var stixPanel = $('#profile-stix-achievements');
                if (target === 'xbox') {
                    if (xboxPanel) xboxPanel.style.display = '';
                    if (stixPanel) stixPanel.style.display = 'none';
                } else {
                    if (xboxPanel) xboxPanel.style.display = 'none';
                    if (stixPanel) stixPanel.style.display = '';
                }
            });
        });
    }

    function loadProfileStixAchievements() {
        var container = $('#profile-stix-achievements');
        if (!container) return;
        var cp = state.cmsProfile;
        if (!cp || !cp.id) {
            container.innerHTML = '<div class="card" style="padding:12px;font-size:13px;color:var(--text-muted);text-align:center">' + I18n.t('ach_login_required') + '</div>';
            return;
        }
        NovaAPI.getStixAchievements(cp.id, function(err, data) {
            if (err || !data) {
                container.innerHTML = '<div class="card" style="padding:12px;font-size:13px;color:var(--text-muted);text-align:center">' + (I18n.t('error') || 'Erro') + '</div>';
                return;
            }
            var defs = data.definitions || [];
            var earned = data.earned || [];
            var progress = data.progress || {};
            if (defs.length === 0) {
                container.innerHTML = '<div class="card" style="padding:12px;font-size:13px;color:var(--text-muted);text-align:center">' + I18n.t('ach_stix_no_defs') + '</div>';
                return;
            }
            var earnedKeys = {};
            earned.forEach(function(e) { earnedKeys[e.achievement_key] = e; });
            var html = '<div class="stix-ach-grid">';
            defs.forEach(function(def) {
                var defKey = def.key || '';
                var isEarned = !!earnedKeys[defKey];
                var earnedData = earnedKeys[defKey];
                var dateStr = '';
                if (isEarned && earnedData && earnedData.unlocked_at) {
                    try { dateStr = new Date(earnedData.unlocked_at).toLocaleDateString(I18n.getDateLocale()); } catch(e) {}
                }
                var loc = getStixAchLocalized(def);
                var progressVal = getStixAchProgress(def, progress);
                var progressPct = progressVal !== null ? Math.min(100, Math.round((progressVal.current / progressVal.target) * 100)) : null;
                html += '<div class="stix-ach-card' + (isEarned ? ' earned' : ' locked') + '">' +
                    '<div class="stix-ach-icon-wrap">' +
                        '<span class="stix-ach-emoji">' + (def.icon || '🏆') + '</span>' +
                    '</div>' +
                    '<div class="stix-ach-info">' +
                        '<div class="stix-ach-name">' + escapeHtml(loc.name) + '</div>' +
                        '<div class="stix-ach-desc">' + escapeHtml(loc.description) + '</div>' +
                        (progressVal !== null && !isEarned ?
                            '<div class="stix-ach-progress-bar"><div class="stix-ach-progress-fill" style="width:' + progressPct + '%"></div></div>' +
                            '<div class="stix-ach-progress-text">' + progressVal.current + '/' + progressVal.target + '</div>'
                            : '') +
                        (isEarned && dateStr ? '<div class="stix-ach-date">' + I18n.t('ach_stix_unlocked') + ' ' + dateStr + '</div>' : '') +
                        (!isEarned && progressVal === null ? '<div class="stix-ach-status-locked">' + I18n.t('ach_stix_locked') + '</div>' : '') +
                    '</div>' +
                '</div>';
            });
            html += '</div>';
            container.innerHTML = html;
        });
    }

    function getStixAchLocalized(def) {
        var defKey = def.key || '';
        var nameKey = 'stix_ach_' + defKey + '_name';
        var descKey = 'stix_ach_' + defKey + '_desc';
        var localName = I18n.t(nameKey);
        var localDesc = I18n.t(descKey);
        return {
            name: (localName && localName !== nameKey) ? localName : (def.name || ''),
            description: (localDesc && localDesc !== descKey) ? localDesc : (def.description || '')
        };
    }

    function getStixAchProgress(def, progress) {
        var rule = def.auto_rule;
        if (!rule || !rule.threshold || rule.threshold <= 0) return null;
        var current = 0;
        var ruleType = rule.type || '';
        if (ruleType === 'downloads') {
            current = progress.downloads || 0;
        } else if (ruleType === 'friends') {
            current = progress.friends || 0;
        } else if (ruleType === 'rooms') {
            current = progress.rooms || 0;
        } else if (ruleType === 'comments') {
            current = progress.comments || 0;
        } else {
            return null;
        }
        return { current: Math.min(current, rule.threshold), target: rule.threshold };
    }

    function loadProfileFavorites() {
        var container = $('#profile-favorites-list');
        if (!container) return;
        var cp = state.cmsProfile;
        if (!cp || !cp.id) {
            container.innerHTML = '<div class="card" style="padding:12px;font-size:13px;color:var(--text-muted);text-align:center">Faça login para ver seus favoritos</div>';
            return;
        }
        NovaAPI.getUserFavorites(cp.id, function(err, data) {
            if (err || !data) {
                container.innerHTML = '<div class="card" style="padding:12px;font-size:13px;color:var(--text-muted);text-align:center">Não foi possível carregar favoritos</div>';
                return;
            }
            var favs = data.favorites || [];
            if (favs.length === 0) {
                container.innerHTML = '<div class="card" style="padding:12px;font-size:13px;color:var(--text-muted);text-align:center">Nenhum jogo favoritado ainda</div>';
                return;
            }
            var html = '<div class="profile-favorites-scroll">';
            favs.forEach(function(f) {
                var g = f.game;
                if (!g) return;
                var coverUrl = g.cover_image || '';
                var playtimeStr = '';
                if (f.playtime_minutes && f.playtime_minutes > 0) {
                    playtimeStr = formatPlaytime(f.playtime_minutes);
                } else if (g.playtime_minutes && g.playtime_minutes > 0) {
                    playtimeStr = formatPlaytime(g.playtime_minutes);
                }
                html += '<div class="profile-fav-item" data-fav-title-id="' + escapeHtml(g.title_id || '') + '">' +
                    '<div class="profile-fav-cover">' +
                        (coverUrl ? '<img src="' + escapeHtml(coverUrl) + '" alt="" onerror="this.onerror=null;this.src=\'img/noboxart.svg\'">' : '<img src="img/noboxart.svg" alt="">') +
                        (playtimeStr ? '<div class="profile-fav-playtime"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="10" height="10"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>' + escapeHtml(playtimeStr) + '</div>' : '') +
                    '</div>' +
                    '<div class="profile-fav-title">' + escapeHtml(g.title || 'Unknown') + '</div>' +
                '</div>';
            });
            html += '</div>';
            container.innerHTML = html;
            container.querySelectorAll('.profile-fav-item').forEach(function(item) {
                item.addEventListener('click', function() {
                    var tid = item.getAttribute('data-fav-title-id');
                    if (tid) {
                        navigateTo('games');
                        setTimeout(function() { showGameDetail(tid); }, 100);
                    }
                });
            });
        });
    }

    function bindPartidasFilter() {
        var bar = $('#partidas-filter-bar');
        if (!bar) return;
        bar.querySelectorAll('.partidas-filter-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                bar.querySelectorAll('.partidas-filter-btn').forEach(function(b) { b.classList.remove('active'); });
                btn.classList.add('active');
                loadProfileGameStats(btn.getAttribute('data-partidas-filter'));
            });
        });
    }

    function loadProfileGameStats(filter) {
        var container = $('#profile-gamestats-list');
        var summaryEl = $('#partidas-summary');
        if (!container) return;
        var cp = state.cmsProfile;
        if (!cp || !cp.id) {
            container.innerHTML = '<div class="card" style="padding:12px;font-size:13px;color:var(--text-muted);text-align:center">Faça login para ver suas partidas</div>';
            return;
        }
        container.innerHTML = '<div class="fm-loading"><div class="spinner"></div></div>';
        NovaAPI.getUserGameStats(cp.id, function(err, data) {
            if (err || !data) {
                container.innerHTML = '<div class="card" style="padding:12px;font-size:13px;color:var(--text-muted);text-align:center">Não foi possível carregar partidas</div>';
                if (summaryEl) summaryEl.innerHTML = '';
                return;
            }
            var allStats = data.game_stats || [];
            if (allStats.length === 0) {
                container.innerHTML = '<div class="card" style="padding:12px;font-size:13px;color:var(--text-muted);text-align:center">' + I18n.t('profile_no_matches') + '</div>';
                if (summaryEl) summaryEl.innerHTML = '';
                return;
            }

            var now = new Date();
            var startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            var startOfWeek = new Date(startOfDay);
            startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
            var startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            var startOfYear = new Date(now.getFullYear(), 0, 1);

            var totalDay = 0, totalWeek = 0, totalMonth = 0, totalYear = 0;
            allStats.forEach(function(s) {
                if (!s.last_played) return;
                var lp = new Date(s.last_played);
                var pt = s.playtime_minutes || 0;
                if (lp >= startOfDay) totalDay += pt;
                if (lp >= startOfWeek) totalWeek += pt;
                if (lp >= startOfMonth) totalMonth += pt;
                if (lp >= startOfYear) totalYear += pt;
            });

            if (summaryEl) {
                summaryEl.innerHTML =
                    '<div class="partidas-summary-grid">' +
                        '<div class="partidas-summary-item"><div class="partidas-summary-value">' + formatPlaytime(totalDay) + '</div><div class="partidas-summary-label">' + I18n.t('profile_summary_today') + '</div></div>' +
                        '<div class="partidas-summary-item"><div class="partidas-summary-value">' + formatPlaytime(totalWeek) + '</div><div class="partidas-summary-label">' + I18n.t('profile_filter_week') + '</div></div>' +
                        '<div class="partidas-summary-item"><div class="partidas-summary-value">' + formatPlaytime(totalMonth) + '</div><div class="partidas-summary-label">' + I18n.t('profile_filter_month') + '</div></div>' +
                        '<div class="partidas-summary-item"><div class="partidas-summary-value">' + formatPlaytime(totalYear) + '</div><div class="partidas-summary-label">' + I18n.t('profile_filter_year') + '</div></div>' +
                    '</div>';
            }

            var filtered = allStats;
            if (filter === 'day') {
                filtered = allStats.filter(function(s) { return s.last_played && new Date(s.last_played) >= startOfDay; });
            } else if (filter === 'week') {
                filtered = allStats.filter(function(s) { return s.last_played && new Date(s.last_played) >= startOfWeek; });
            } else if (filter === 'month') {
                filtered = allStats.filter(function(s) { return s.last_played && new Date(s.last_played) >= startOfMonth; });
            } else if (filter === 'year') {
                filtered = allStats.filter(function(s) { return s.last_played && new Date(s.last_played) >= startOfYear; });
            }

            if (filtered.length === 0) {
                container.innerHTML = '<div class="card" style="padding:12px;font-size:13px;color:var(--text-muted);text-align:center">' + I18n.t('profile_no_matches_period') + '</div>';
                return;
            }

            var cmsBase = NovaAPI.getCmsUrl ? NovaAPI.getCmsUrl() : '';
            var html = '<div class="partidas-list">';
            filtered.forEach(function(s) {
                var game = s.game || {};
                var coverUrl = game.cover_image || '';
                if (coverUrl && coverUrl.indexOf('/') === 0 && cmsBase) coverUrl = cmsBase + coverUrl;
                var title = game.title || 'Unknown';
                var playtime = formatPlaytime(s.playtime_minutes || 0);
                var lastPlayed = '';
                if (s.last_played) {
                    try { lastPlayed = new Date(s.last_played).toLocaleDateString('pt-BR'); } catch(e) {}
                }
                html += '<div class="partidas-item card">' +
                    '<div class="partidas-cover">' +
                        (coverUrl ? '<img src="' + escapeHtml(coverUrl) + '" alt="" onerror="this.onerror=null;this.src=\'img/noboxart.svg\'">' : '<img src="img/noboxart.svg" alt="">') +
                    '</div>' +
                    '<div class="partidas-info">' +
                        '<div class="partidas-title">' + escapeHtml(title) + '</div>' +
                        '<div class="partidas-meta">' +
                            '<span class="partidas-playtime">' + escapeHtml(playtime) + '</span>' +
                            (s.times_launched ? '<span class="partidas-launches">' + s.times_launched + 'x</span>' : '') +
                            (lastPlayed ? '<span class="partidas-date">' + lastPlayed + '</span>' : '') +
                        '</div>' +
                        (s.completed ? '<span class="badge badge-success" style="margin-top:4px">Completo</span>' : '') +
                    '</div>' +
                '</div>';
            });
            html += '</div>';
            container.innerHTML = html;
        });
    }

    function renderAchGroups(gameGroups, gameOrder, totalCounts, cmsBase, isOwn, container, profileId, cmsGameMap) {
        var html = '';
        var _cmsMap = cmsGameMap || {};
        gameOrder.forEach(function(tid) {
            var items = gameGroups[tid];
            if (!items || items.length === 0) return;
            var earned = items.length;
            var total = totalCounts[tid] || earned;
            var firstItem = items[0];
            var gameName = '';
            var key = firstItem.achievement_key || '';
            var matchedGame = findGameByTitleId(tid);
            if (matchedGame) gameName = getGameName(matchedGame);
            if (!gameName && _cmsMap[tid]) gameName = _cmsMap[tid].title || '';
            if (!gameName) gameName = tid !== 'UNKNOWN' ? ('Title ' + tid) : 'Unknown';
            var gameArt = matchedGame ? getGameArt(matchedGame) : '';
            if (!gameArt && _cmsMap[tid] && _cmsMap[tid].cover_image) {
                var ci = _cmsMap[tid].cover_image;
                gameArt = (ci.indexOf('http') === 0) ? ci : cmsBase + ci;
            }

            var deleteBtn = '';
            if (isOwn) {
                deleteBtn = '<button class="pub-ach-delete-btn" data-title-id="' + escapeHtml(tid) + '" title="' + I18n.t('delete') + '">' +
                    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>' +
                '</button>';
            }

            html += '<div class="pub-ach-game-group" data-group-tid="' + escapeHtml(tid) + '">' +
                '<div class="pub-ach-game-header">' +
                    '<div class="pub-ach-game-cover">' +
                        (gameArt ? '<img src="' + escapeHtml(gameArt) + '" alt="" onerror="this.onerror=null;this.src=\'img/noboxart.svg\'">' : '<img src="img/noboxart.svg" alt="">') +
                    '</div>' +
                    '<div class="pub-ach-game-info">' +
                        '<div class="pub-ach-game-name">' + escapeHtml(gameName) + '</div>' +
                        '<div class="pub-ach-game-count">' + earned + '/' + total + ' ' + I18n.t('profile_achievements') + '</div>' +
                    '</div>' +
                    deleteBtn +
                '</div>' +
                '<div class="pub-ach-game-items">';

            items.forEach(function(a) {
                var iconSrc = a.icon || '';
                if (iconSrc && iconSrc.indexOf('/') === 0 && cmsBase) iconSrc = cmsBase + iconSrc;
                var iconHtml = iconSrc
                    ? '<img class="pub-ach-icon-img" src="' + escapeHtml(iconSrc) + '" alt="" onerror="this.onerror=null;this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'">' +
                      '<span class="pub-ach-icon-fallback" style="display:none">🏆</span>'
                    : '<span class="pub-ach-icon-fallback">🏆</span>';

                html += '<div class="public-ach-item">' +
                    '<div class="pub-ach-icon-wrap">' + iconHtml + '</div>' +
                    '<div class="public-ach-info">' +
                        '<div class="public-ach-name">' + escapeHtml(a.achievement_name || a.name || '') + '</div>' +
                        '<div class="public-ach-desc">' + escapeHtml(a.achievement_description || a.description || '') + '</div>' +
                    '</div>' +
                '</div>';
            });

            html += '</div></div>';
        });

        container.innerHTML = html || '<div class="card" style="padding:12px;font-size:13px;color:var(--text-muted);text-align:center">' + I18n.t('ach_none_yet') + '</div>';

        if (isOwn) {
            container.querySelectorAll('.pub-ach-delete-btn').forEach(function(btn) {
                btn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    var tid = btn.getAttribute('data-title-id');
                    showConfirmDialog(I18n.t('profile_delete_game_achievements_confirm') || 'Deseja apagar todas as conquistas deste jogo?', function() {
                        btn.disabled = true;
                        btn.style.opacity = '0.3';
                        NovaAPI.deleteGameAchievements(profileId, tid, function(err, resp) {
                            if (err) {
                                btn.disabled = false;
                                btn.style.opacity = '';
                                showToast(I18n.t('error') || 'Erro');
                                return;
                            }
                            var group = container.querySelector('[data-group-tid="' + tid + '"]');
                            if (group) group.remove();
                            if (resp && resp.achievements_count !== undefined) {
                                var countEl = document.querySelector('.profile-card-stat-val');
                                if (countEl) {
                                    var statEls = document.querySelectorAll('.profile-card-stat');
                                    statEls.forEach(function(s) {
                                        var lbl = s.querySelector('.profile-card-stat-lbl');
                                        if (lbl && lbl.textContent === I18n.t('profile_achievements')) {
                                            var valEl = s.querySelector('.profile-card-stat-val');
                                            if (valEl) valEl.textContent = resp.achievements_count;
                                        }
                                    });
                                }
                            }
                            showToast(I18n.t('success') || 'Conquistas removidas');
                        });
                    });
                });
            });
        }
    }

    function showUserPublicProfile(profileId) {
        var cameFromPage = state.currentPage;
        if (state.currentPage !== 'games') {
            navigateTo('games', true);
        }
        var el = $('#page-games');
        if (!el) return;
        el.classList.add('active');

        el.innerHTML = '<div class="fm-loading"><div class="spinner"></div></div>';

        NovaAPI.getUserPublicProfile(profileId, function(err, profile) {
            if (err || !profile) {
                el.innerHTML = '<button class="back-btn" id="public-profile-back"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg> Voltar</button>' +
                    '<div class="empty-state"><p>Não foi possível carregar o perfil.</p></div>';
                var bb = el.querySelector('#public-profile-back');
                if (bb) bb.addEventListener('click', function() { renderGames(); });
                return;
            }

            var avatarInitial = (profile.display_name || profile.username || '?')[0].toUpperCase();
            var avatarHtml = profile.avatar_url
                ? '<img class="profile-page-avatar" src="' + escapeHtml(profile.avatar_url) + '" alt="" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'">' +
                  '<div class="profile-page-avatar-fallback" style="display:none">' + escapeHtml(avatarInitial) + '</div>'
                : '<div class="profile-page-avatar-fallback">' + escapeHtml(avatarInitial) + '</div>';

            var pubCoverUrl = profile.cover_url || '';
            var pubCoverStyle = pubCoverUrl ? 'background-image:url(' + escapeHtml(pubCoverUrl) + ')' : '';

            var pubOnlineBadge = profile.is_online
                ? '<span class="profile-badge-online"><span class="profile-online-indicator"></span>' + I18n.t('profile_online') + '</span>'
                : '';
            var pubLevelBadge = profile.level_name
                ? '<span class="profile-badge-level">' + escapeHtml(profile.level_name) + '</span>'
                : '';

            var pubDownloads = profile.total_downloads || 0;
            var pubAchievements = (!profile.privacy_achievements && profile.achievements_count) ? profile.achievements_count : 0;

            var html = '<button class="back-btn" id="public-profile-back"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg> ' + I18n.t('back') + '</button>';

            html += '<div class="profile-card-v2">' +
                '<div class="profile-card-cover" style="' + pubCoverStyle + '">' +
                    '<div class="profile-card-cover-overlay"></div>' +
                '</div>' +
                '<div class="profile-card-body">' +
                    '<div class="profile-card-avatar-wrap">' + avatarHtml + '</div>' +
                    '<div class="profile-card-username-row">' +
                        '<span class="profile-card-username">' + escapeHtml(profile.display_name || profile.username) + '</span>' +
                        pubOnlineBadge +
                    '</div>' +
                    '<div class="profile-card-code-row">' +
                        (profile.friend_code ? '<div class="profile-friend-code-display"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> ' + escapeHtml(profile.friend_code) + '</div>' : '') +
                        (function() {
                            if (!state.cmsFriendsList) return '';
                            var match = state.cmsFriendsList.find(function(f) { return String(f.id) === String(profileId); });
                            if (!match || !match.friendship_id) return '';
                            return '<button class="btn profile-unfriend-btn" id="public-profile-unfriend" data-fid="' + match.friendship_id + '">' +
                                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="18" y1="11" x2="23" y2="11"/></svg> ' +
                                I18n.t('profile_remove_friend') + '</button>';
                        })() +
                        pubLevelBadge +
                    '</div>' +
                    '<div class="profile-card-stats">' +
                        '<div class="profile-card-stat">' +
                            '<div class="profile-card-stat-val">' + pubDownloads + '</div>' +
                            '<div class="profile-card-stat-lbl">' + I18n.t('profile_downloads') + '</div>' +
                        '</div>' +
                        '<div class="profile-card-stat">' +
                            '<div class="profile-card-stat-val">' + pubAchievements + '</div>' +
                            '<div class="profile-card-stat-lbl">' + I18n.t('profile_achievements') + '</div>' +
                        '</div>' +
                    '</div>' +
                '</div>' +
            '</div>';

            if (profile.bio) {
                html += '<div class="profile-bio-section"><div class="profile-bio">' + sanitizeBioHtml(profile.bio) + '</div></div>';
            }
            if (profile.custom_link_url && profile.custom_link_title) {
                html += '<div style="text-align:center;margin-bottom:12px"><a class="profile-custom-link-btn" href="' + escapeHtml(profile.custom_link_url) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(profile.custom_link_title) + '</a></div>';
            }

            if (!profile.privacy_achievements) {
                html += '<div class="section-title">' + I18n.t('profile_achievements_section') + '</div>' +
                    '<div class="ach-subtabs">' +
                        '<button class="ach-subtab active" data-ach-tab="xbox">' + I18n.t('ach_tab_xbox') + '</button>' +
                        '<button class="ach-subtab" data-ach-tab="stix">' + I18n.t('ach_tab_stix') + '</button>' +
                    '</div>' +
                    '<div id="public-profile-achievements" class="ach-tab-content active"><div class="fm-loading"><div class="spinner"></div></div></div>' +
                    '<div id="public-profile-stix-achievements" class="ach-tab-content" style="display:none"><div class="fm-loading"><div class="spinner"></div></div></div>';
            }

            html += '<div class="profile-fav-section-title">' + I18n.t('profile_fav_games') + '</div>' +
                '<div id="public-profile-favorites"><div class="fm-loading"><div class="spinner"></div></div></div>';

            el.innerHTML = html;

            var backBtn = el.querySelector('#public-profile-back');
            if (backBtn) {
                backBtn.addEventListener('click', function() {
                    if (cameFromPage && cameFromPage !== 'games') {
                        navigateTo(cameFromPage);
                    } else if (state.selectedGame) {
                        showGameDetail(getGameId(state.selectedGame));
                    } else {
                        renderGames();
                    }
                });
            }

            var unfriendBtn = el.querySelector('#public-profile-unfriend');
            if (unfriendBtn) {
                unfriendBtn.addEventListener('click', function() {
                    var fid = unfriendBtn.getAttribute('data-fid');
                    showConfirmDialog(I18n.t('profile_remove_confirm'), function() {
                        unfriendBtn.disabled = true;
                        unfriendBtn.style.opacity = '0.5';
                        NovaAPI.removeFriend(fid, function(err) {
                            if (err) {
                                unfriendBtn.disabled = false;
                                unfriendBtn.style.opacity = '';
                                showToast(I18n.t('error'));
                                return;
                            }
                            unfriendBtn.remove();
                            if (state.cmsFriendsList) {
                                state.cmsFriendsList = state.cmsFriendsList.filter(function(f) { return String(f.friendship_id) !== String(fid); });
                            }
                            showToast(I18n.t('success'));
                        });
                    });
                });
            }

            NovaAPI.getUserAchievements(profileId, function(err2, achData) {
                var achContainer = el.querySelector('#public-profile-achievements');
                if (!achContainer || profile.privacy_achievements) return;
                if (err2 || !achData) {
                    achContainer.innerHTML = '<div class="card" style="padding:12px;font-size:13px;color:var(--text-muted);text-align:center">' + I18n.t('ach_load_error') + '</div>';
                    return;
                }
                var allAchs = achData.achievements || [];
                var achs = allAchs.filter(function(a) {
                    return a.achievement_key && a.achievement_key.indexOf('xbox_') === 0;
                });
                if (achs.length === 0) {
                    achContainer.innerHTML = '<div class="card" style="padding:12px;font-size:13px;color:var(--text-muted);text-align:center">' + I18n.t('ach_none_yet') + '</div>';
                    return;
                }

                var gameGroups = {};
                var gameOrder = [];
                achs.forEach(function(a) {
                    var key = a.achievement_key || '';
                    var parts = key.match(/^xbox_([A-Fa-f0-9]+)_/);
                    var tid = parts ? parts[1].toUpperCase() : 'UNKNOWN';
                    if (!gameGroups[tid]) {
                        gameGroups[tid] = [];
                        gameOrder.push(tid);
                    }
                    gameGroups[tid].push(a);
                });

                var cmsBase = NovaAPI.getCmsUrl ? NovaAPI.getCmsUrl() : '';
                var myProfile = NovaAPI.getCmsProfileData ? NovaAPI.getCmsProfileData() : null;
                var isOwn = myProfile && String(myProfile.id) === String(profileId);

                var titleIds = gameOrder.filter(function(t) { return t !== 'UNKNOWN'; });
                var countsUrl = cmsBase + '/api/game-achievements/counts?title_ids=' + titleIds.join(',');

                var unknownTids = titleIds.filter(function(t) { return !findGameByTitleId(t); });

                function doRenderAchs(totalCounts, cmsGameMap) {
                    renderAchGroups(gameGroups, gameOrder, totalCounts, cmsBase, isOwn, achContainer, profileId, cmsGameMap);
                }

                function fetchCmsGames(totalCounts) {
                    if (unknownTids.length === 0 || !cmsBase) {
                        doRenderAchs(totalCounts, {});
                        return;
                    }
                    var cmsGameMap = {};
                    var pending = unknownTids.length;
                    unknownTids.forEach(function(tid) {
                        NovaAPI.cmsLookupGameByTitleId(tid, function(lookErr, lookData) {
                            if (!lookErr && lookData && lookData.game) {
                                cmsGameMap[tid] = lookData.game;
                            }
                            pending--;
                            if (pending <= 0) {
                                doRenderAchs(totalCounts, cmsGameMap);
                            }
                        });
                    });
                }

                var xhr = new XMLHttpRequest();
                xhr.open('GET', countsUrl, true);
                xhr.timeout = 10000;
                xhr.onload = function() {
                    var totalCounts = {};
                    if (xhr.status >= 200 && xhr.status < 300) {
                        try {
                            var resp = JSON.parse(xhr.responseText);
                            if (resp.success && resp.counts) totalCounts = resp.counts;
                        } catch(e) {}
                    }
                    fetchCmsGames(totalCounts);
                };
                xhr.onerror = function() {
                    fetchCmsGames({});
                };
                xhr.ontimeout = function() {
                    fetchCmsGames({});
                };
                xhr.send();
            });

            if (!profile.privacy_achievements) {
                NovaAPI.getStixAchievements(profileId, function(stixErr, stixData) {
                    var stixContainer = el.querySelector('#public-profile-stix-achievements');
                    if (!stixContainer) return;
                    if (stixErr || !stixData) {
                        stixContainer.innerHTML = '<div class="card" style="padding:12px;font-size:13px;color:var(--text-muted);text-align:center">' + (I18n.t('error') || 'Erro') + '</div>';
                        return;
                    }
                    var defs = stixData.definitions || [];
                    var earned = stixData.earned || [];
                    var progress = stixData.progress || {};
                    if (defs.length === 0) {
                        stixContainer.innerHTML = '<div class="card" style="padding:12px;font-size:13px;color:var(--text-muted);text-align:center">' + I18n.t('ach_stix_no_defs') + '</div>';
                        return;
                    }
                    var earnedKeys = {};
                    earned.forEach(function(e) { earnedKeys[e.achievement_key] = e; });
                    var html = '<div class="stix-ach-grid">';
                    defs.forEach(function(def) {
                        var defKey = def.key || '';
                        var isEarned = !!earnedKeys[defKey];
                        var earnedData = earnedKeys[defKey];
                        var dateStr = '';
                        if (isEarned && earnedData && earnedData.unlocked_at) {
                            try { dateStr = new Date(earnedData.unlocked_at).toLocaleDateString(I18n.getDateLocale()); } catch(e) {}
                        }
                        var loc = getStixAchLocalized(def);
                        var progressVal = getStixAchProgress(def, progress);
                        var progressPct = progressVal !== null ? Math.min(100, Math.round((progressVal.current / progressVal.target) * 100)) : null;
                        html += '<div class="stix-ach-card' + (isEarned ? ' earned' : ' locked') + '">' +
                            '<div class="stix-ach-icon-wrap">' +
                                '<span class="stix-ach-emoji">' + (def.icon || '🏆') + '</span>' +
                            '</div>' +
                            '<div class="stix-ach-info">' +
                                '<div class="stix-ach-name">' + escapeHtml(loc.name) + '</div>' +
                                '<div class="stix-ach-desc">' + escapeHtml(loc.description) + '</div>' +
                                (progressVal !== null && !isEarned ?
                                    '<div class="stix-ach-progress-bar"><div class="stix-ach-progress-fill" style="width:' + progressPct + '%"></div></div>' +
                                    '<div class="stix-ach-progress-text">' + progressVal.current + '/' + progressVal.target + '</div>'
                                    : '') +
                                (isEarned && dateStr ? '<div class="stix-ach-date">' + I18n.t('ach_stix_unlocked') + ' ' + dateStr + '</div>' : '') +
                                (!isEarned && progressVal === null ? '<div class="stix-ach-status-locked">' + I18n.t('ach_stix_locked') + '</div>' : '') +
                            '</div>' +
                        '</div>';
                    });
                    html += '</div>';
                    stixContainer.innerHTML = html;
                });

                var pubSubtabs = el.querySelectorAll('.ach-subtab');
                pubSubtabs.forEach(function(tab) {
                    tab.addEventListener('click', function() {
                        var target = tab.getAttribute('data-ach-tab');
                        pubSubtabs.forEach(function(t) { t.classList.remove('active'); });
                        tab.classList.add('active');
                        var xboxPanel = el.querySelector('#public-profile-achievements');
                        var stixPanel = el.querySelector('#public-profile-stix-achievements');
                        if (target === 'xbox') {
                            if (xboxPanel) xboxPanel.style.display = '';
                            if (stixPanel) stixPanel.style.display = 'none';
                        } else {
                            if (xboxPanel) xboxPanel.style.display = 'none';
                            if (stixPanel) stixPanel.style.display = '';
                        }
                    });
                });
            }

            NovaAPI.getUserFavorites(profileId, function(err3, favData) {
                var favContainer = el.querySelector('#public-profile-favorites');
                if (!favContainer) return;
                if (err3 || !favData) {
                    favContainer.innerHTML = '<div class="card" style="padding:12px;font-size:13px;color:var(--text-muted);text-align:center">Não foi possível carregar</div>';
                    return;
                }
                var favs = favData.favorites || [];
                if (favs.length === 0) {
                    favContainer.innerHTML = '<div class="card" style="padding:12px;font-size:13px;color:var(--text-muted);text-align:center">Nenhum jogo favoritado</div>';
                    return;
                }
                var favCmsBase = NovaAPI.getCmsUrl ? NovaAPI.getCmsUrl() : '';
                var favHtml = '<div class="profile-favorites-scroll">';
                favs.forEach(function(f) {
                    var g = f.game;
                    if (!g) return;
                    var coverUrl = g.cover_image || '';
                    if (coverUrl && coverUrl.indexOf('/') === 0 && favCmsBase) coverUrl = favCmsBase + coverUrl;
                    var playtimeStr = '';
                    if (f.playtime_minutes && f.playtime_minutes > 0) {
                        playtimeStr = formatPlaytime(f.playtime_minutes);
                    } else if (g.playtime_minutes && g.playtime_minutes > 0) {
                        playtimeStr = formatPlaytime(g.playtime_minutes);
                    }
                    favHtml += '<div class="profile-fav-item" data-fav-title-id="' + escapeHtml(g.title_id || '') + '">' +
                        '<div class="profile-fav-cover">' +
                            (coverUrl ? '<img src="' + escapeHtml(coverUrl) + '" alt="" onerror="this.onerror=null;this.src=\'img/noboxart.svg\'">' : '<img src="img/noboxart.svg" alt="">') +
                            (playtimeStr ? '<div class="profile-fav-playtime"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="10" height="10"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>' + escapeHtml(playtimeStr) + '</div>' : '') +
                        '</div>' +
                        '<div class="profile-fav-title">' + escapeHtml(g.title || 'Unknown') + '</div>' +
                    '</div>';
                });
                favHtml += '</div>';
                favContainer.innerHTML = favHtml;
                favContainer.querySelectorAll('.profile-fav-item').forEach(function(item) {
                    item.addEventListener('click', function() {
                        var tid = item.getAttribute('data-fav-title-id');
                        if (tid) {
                            state.selectedGame = null;
                            showGameDetail(tid);
                        }
                    });
                });
            });
        });
    }

    function loadXboxProfileSelectorInto(container) {
        if (!container) return;
        container.innerHTML = '<div class="fm-loading"><div class="spinner"></div></div>';

        NovaAPI.getProfiles(function(err, data) {
            if (!container) return;
            var profiles = [];
            if (!err && data) {
                if (Array.isArray(data)) profiles = data;
                else if (Array.isArray(data.profiles)) profiles = data.profiles;
                else if (data.gamertag || data.Gamertag) profiles = [data];
            }

            profiles.forEach(function(p, idx) {
                if (p && p.index == null) p.index = idx;
            });

            var activeProfiles = profiles.filter(function(p) {
                return p && (p.gamertag || p.Gamertag) && (p.xuid || p.Xuid);
            });

            if (activeProfiles.length === 0) {
                container.innerHTML = '<p style="font-size:12px;color:var(--text-muted)">Nenhum perfil Xbox encontrado. Faça login no Xbox 360 primeiro.</p>';
                return;
            }

            var html = '<div class="xbox-profile-selector">';
            activeProfiles.forEach(function(p) {
                var gt = p.gamertag || p.Gamertag || '---';
                var xuid = p.xuid || p.Xuid || '';
                var last7 = xuid.replace(/^0x/i, '').toUpperCase().slice(-7);
                html += '<button class="xbox-profile-option" data-xuid="' + escapeHtml(xuid) + '" data-gt="' + escapeHtml(gt) + '">' +
                    '<div class="xbox-profile-option-name">' + escapeHtml(gt) + '</div>' +
                    '<div class="xbox-profile-option-xuid">XUID: ' + escapeHtml(xuid) + '</div>' +
                    '<div class="xbox-profile-option-code">Código: ' + escapeHtml(last7) + '</div>' +
                '</button>';
            });
            html += '</div>';
            container.innerHTML = html;

            container.querySelectorAll('.xbox-profile-option').forEach(function(btn) {
                btn.addEventListener('click', function() {
                    var xuid = this.getAttribute('data-xuid');
                    var gt = this.getAttribute('data-gt');
                    btn.disabled = true;
                    btn.textContent = 'Salvando...';
                    NovaAPI.setPrimaryXuid(xuid, gt, function(err, resp) {
                        if (err) {
                            btn.textContent = 'Erro: ' + err.message;
                            btn.disabled = false;
                            return;
                        }
                        if (state.cmsProfile) {
                            state.cmsProfile.friend_code = resp.friend_code;
                            state.cmsProfile.primary_xuid = resp.primary_xuid;
                            NovaAPI.setCmsProfileData(state.cmsProfile);
                        }
                        var popupOverlay = document.querySelector('.profile-info-popup-overlay');
                        if (popupOverlay) popupOverlay.remove();
                        renderProfile();
                    });
                });
            });
        });
    }

    function bindFriendCodeSearch() {
        var btn = $('#friend-code-search-btn');
        var input = $('#friend-code-input');
        if (!btn || !input) return;

        btn.addEventListener('click', function() {
            var code = input.value.trim().toUpperCase();
            if (code.length !== 7) {
                var result = $('#friend-code-result');
                if (result) result.innerHTML = '<p class="friend-search-error">O código deve ter 7 caracteres</p>';
                return;
            }
            btn.disabled = true;
            btn.textContent = 'Buscando...';
            NovaAPI.lookupByFriendCode(code, function(err, profile) {
                btn.disabled = false;
                btn.textContent = 'Buscar';
                var result = $('#friend-code-result');
                if (!result) return;
                if (err) {
                    result.innerHTML = '<p class="friend-search-error">' + escapeHtml(err.message) + '</p>';
                    return;
                }
                var myId = getCmsProfileId();
                if (profile.id === myId) {
                    result.innerHTML = '<p class="friend-search-error">Este é o seu próprio código</p>';
                    return;
                }
                var pName = profile.display_name || profile.username || 'Unknown';
                result.innerHTML = '<div class="friend-search-result">' +
                    '<div class="friend-search-name">' + escapeHtml(pName) +
                        (profile.level_name ? ' <span class="cms-level-badge" style="font-size:9px">' + escapeHtml(profile.level_name) + '</span>' : '') +
                    '</div>' +
                    '<button class="btn btn-primary btn-sm" id="send-friend-req-btn" data-target-id="' + profile.id + '">Adicionar</button>' +
                '</div>';
                var sendBtn = result.querySelector('#send-friend-req-btn');
                if (sendBtn) {
                    sendBtn.addEventListener('click', function() {
                        var targetId = parseInt(this.getAttribute('data-target-id'));
                        this.disabled = true;
                        this.textContent = 'Enviando...';
                        var btnRef = this;
                        NovaAPI.sendFriendRequest(targetId, function(err2) {
                            if (err2) {
                                btnRef.textContent = err2.message;
                                btnRef.style.background = 'var(--danger)';
                            } else {
                                btnRef.textContent = 'Enviado!';
                                btnRef.style.background = 'var(--success)';
                            }
                        });
                    });
                }
            });
        });
    }

    function renderFriendsFiltered(container, friends, filter) {
        var isOwnProfile = isCmsLoggedIn() && !!getCmsProfileId();
        var list = filter === 'online' ? friends.filter(function(f) { return f.is_online; }) : friends;
        if (list.length === 0) {
            container.innerHTML = '<div class="card" style="padding:12px;font-size:13px;color:var(--text-muted);text-align:center">' +
                (filter === 'online' ? I18n.t('profile_no_friends_online') : I18n.t('profile_no_friends')) + '</div>';
            return;
        }
        var html = '<div class="friends-list">';
        list.forEach(function(f) {
            var fName = f.display_name || f.username || 'Unknown';
            var initial = (fName[0] || '?').toUpperCase();
            var onlineClass = f.is_online ? ' friend-online' : '';
            var statusText = '';
            if (f.is_online && f.current_game_title) {
                statusText = '<div class="friend-status-text">' + I18n.t('profile_playing') + ': ' + escapeHtml(f.current_game_title) + '</div>';
            } else if (f.is_online) {
                statusText = '<div class="friend-status-text friend-status-online">' + I18n.t('profile_online') + '</div>';
            } else if (f.last_seen) {
                var ago = formatTimeAgo(f.last_seen);
                if (ago) statusText = '<div class="friend-status-text friend-status-offline">' + I18n.t('profile_seen_prefix') + ' ' + ago + '</div>';
            }
            html += '<div class="friend-item' + onlineClass + '" data-friend-id="' + f.id + '">' +
                '<div class="friend-avatar-wrap">' +
                    '<div class="friend-avatar">';
            if (f.avatar_url) {
                html += '<img src="' + escapeHtml(f.avatar_url) + '" alt="" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'">' +
                    '<div class="friend-avatar-fallback" style="display:none">' + escapeHtml(initial) + '</div>';
            } else {
                html += '<div class="friend-avatar-fallback">' + escapeHtml(initial) + '</div>';
            }
            html += '</div>' +
                (f.is_online ? '<span class="friend-online-dot"></span>' : '') +
                '</div>' +
                '<div class="friend-info friend-profile-link" data-profile-id="' + f.id + '">' +
                    '<div class="friend-name">' + escapeHtml(fName) + '</div>' +
                    (f.level_name ? '<span class="cms-level-badge" style="font-size:9px">' + escapeHtml(f.level_name) + '</span>' : '') +
                    statusText +
                '</div>';
            if (isOwnProfile) {
                html += '<button class="btn btn-sm friend-remove-btn" data-fid="' + f.friendship_id + '" title="Remover">' +
                    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
                '</button>';
            }
            html += '</div>';
        });
        html += '</div>';
        container.innerHTML = html;

        container.querySelectorAll('.friend-profile-link').forEach(function(el) {
            el.addEventListener('click', function() {
                var pid = parseInt(this.getAttribute('data-profile-id'));
                if (pid) {
                    showUserPublicProfile(pid);
                }
            });
        });

        if (isOwnProfile) {
            container.querySelectorAll('.friend-remove-btn').forEach(function(btn) {
                btn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    var fid = parseInt(this.getAttribute('data-fid'));
                    if (!confirm('Remover este amigo?')) return;
                    btn.disabled = true;
                    NovaAPI.removeFriend(fid, function(err2) {
                        if (!err2) loadFriendsList();
                        else { btn.disabled = false; }
                    });
                });
            });
        }
    }

    function bindFriendsFilter(container, friends) {
        var btns = document.querySelectorAll('.friends-filter-btn');
        btns.forEach(function(btn) {
            btn.addEventListener('click', function() {
                btns.forEach(function(b) { b.classList.remove('active'); });
                btn.classList.add('active');
                var filter = btn.getAttribute('data-friends-filter');
                renderFriendsFiltered(container, friends, filter);
            });
        });
        var onlineCount = friends.filter(function(f) { return f.is_online; }).length;
        var onlineBtn = document.querySelector('.friends-filter-btn[data-friends-filter="online"]');
        if (onlineBtn) {
            onlineBtn.textContent = 'Online (' + onlineCount + ')';
        }
    }

    function formatTimeAgo(dateStr) {
        if (!dateStr) return '';
        var now = Date.now();
        var then = new Date(dateStr).getTime();
        var diff = Math.floor((now - then) / 1000);
        if (diff < 60) return I18n.t('profile_seen_now');
        if (diff < 3600) return I18n.t('profile_seen_min', {n: Math.floor(diff / 60)});
        if (diff < 86400) return I18n.t('profile_seen_hours', {n: Math.floor(diff / 3600)});
        if (diff < 604800) return I18n.t('profile_seen_days', {n: Math.floor(diff / 86400)});
        return '';
    }

    function loadFriendsList() {
        var profileId = getCmsProfileId();
        if (!profileId) return;
        var container = $('#profile-friends-list');
        var pendingContainer = $('#profile-pending-requests');

        NovaAPI.getFriendsList(profileId, function(err, data) {
            if (err || !data) {
                if (container) container.innerHTML = '<p style="font-size:12px;color:var(--text-muted);padding:8px">Não foi possível carregar amigos</p>';
                return;
            }

            var friends = data.friends || [];
            var pending = data.pending_requests || [];
            state.cmsFriendsList = friends;

            var friendsCountEl = document.querySelector('#profile-friends-count');
            if (friendsCountEl) friendsCountEl.textContent = friends.length;

            if (container) {
                if (friends.length === 0) {
                    container.innerHTML = '<div class="card" style="padding:12px;font-size:13px;color:var(--text-muted);text-align:center">Nenhum amigo adicionado ainda</div>';
                } else {
                    renderFriendsFiltered(container, friends, 'all');
                    bindFriendsFilter(container, friends);
                }
            }

            if (pendingContainer) {
                if (pending.length === 0) {
                    pendingContainer.innerHTML = '<div class="card" style="padding:12px;font-size:13px;color:var(--text-muted);text-align:center">Nenhum pedido pendente</div>';
                } else {
                    var pHtml = '<div class="friends-list">';
                    pending.forEach(function(req) {
                        var reqProfile = req.requester || {};
                        var rName = reqProfile.display_name || reqProfile.username || 'Unknown';
                        var rInitial = (rName[0] || '?').toUpperCase();
                        pHtml += '<div class="friend-item">' +
                            '<div class="friend-avatar">';
                        if (reqProfile.avatar_url) {
                            pHtml += '<img src="' + escapeHtml(reqProfile.avatar_url) + '" alt="" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'">' +
                                '<div class="friend-avatar-fallback" style="display:none">' + escapeHtml(rInitial) + '</div>';
                        } else {
                            pHtml += '<div class="friend-avatar-fallback">' + escapeHtml(rInitial) + '</div>';
                        }
                        pHtml += '</div>' +
                            '<div class="friend-info">' +
                                '<div class="friend-name">' + escapeHtml(rName) + '</div>' +
                            '</div>' +
                            '<div class="friend-request-actions">' +
                                '<button class="btn btn-sm btn-primary friend-accept-btn" data-fid="' + req.id + '">Aceitar</button>' +
                                '<button class="btn btn-sm friend-reject-btn" data-fid="' + req.id + '">Recusar</button>' +
                            '</div>' +
                        '</div>';
                    });
                    pHtml += '</div>';
                    pendingContainer.innerHTML = pHtml;

                    pendingContainer.querySelectorAll('.friend-accept-btn').forEach(function(btn) {
                        btn.addEventListener('click', function() {
                            var fid = parseInt(this.getAttribute('data-fid'));
                            btn.disabled = true;
                            btn.textContent = '...';
                            NovaAPI.respondFriendRequest(fid, 'accepted', function(err2) {
                                if (!err2) loadFriendsList();
                            });
                        });
                    });
                    pendingContainer.querySelectorAll('.friend-reject-btn').forEach(function(btn) {
                        btn.addEventListener('click', function() {
                            var fid = parseInt(this.getAttribute('data-fid'));
                            btn.disabled = true;
                            btn.textContent = '...';
                            NovaAPI.respondFriendRequest(fid, 'rejected', function(err2) {
                                if (!err2) loadFriendsList();
                            });
                        });
                    });
                }
            }
        });
    }

    function renderRooms() {
        var el = $('#page-rooms');
        if (!el) return;

        if (!state.isOnline) {
            el.innerHTML = '<div class="page-header"><div><div class="page-title">Game Rooms</div></div></div>' +
                '<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/></svg>' +
                '<p>Salas indisponíveis offline</p><p style="font-size:12px;margin-top:4px">Conecte-se à internet para acessar as salas</p></div>';
            return;
        }

        if (roomsDetailRoom) {
            renderRoomDetail(el);
            return;
        }

        if (roomsShowCreateForm) {
            renderRoomCreateForm(el);
            return;
        }

        var headerHtml = '<div class="page-header"><div><div class="page-title">' + I18n.t('rooms_title') + '</div></div>' +
            (isCmsLoggedIn() ? '<button class="btn btn-primary btn-sm" id="rooms-create-btn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" style="vertical-align:-2px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> ' + I18n.t('rooms_create_btn') + '</button>' : '') +
        '</div>';

        var tabsHtml = '<div class="tabs">' +
            '<button class="tab' + (roomsTab === 'public' ? ' active' : '') + '" data-rooms-tab="public">' + I18n.t('rooms_tab_public') + '</button>' +
            (isCmsLoggedIn() ? '<button class="tab' + (roomsTab === 'my' ? ' active' : '') + '" data-rooms-tab="my">' + I18n.t('rooms_tab_my') + '</button>' : '') +
        '</div>';

        var searchAndFilterHtml = '';
        if (roomsTab === 'public') {
            searchAndFilterHtml = '<div class="rooms-search-filter">' +
                '<div class="rooms-search-wrap">' +
                    '<svg class="rooms-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>' +
                    '<input type="text" id="rooms-search-input" class="rooms-search-input" placeholder="' + I18n.t('rooms_search_placeholder') + '" value="' + escapeHtml(roomsSearchQuery) + '" autocomplete="off">' +
                '</div>';

            if (roomsData && roomsData.rooms && roomsData.rooms.length > 0) {
                var roomGames = {};
                roomsData.rooms.forEach(function(r) {
                    var gt = r.game_title || (r.game ? r.game.title : '');
                    if (gt) roomGames[gt] = true;
                });
                var gameNames = Object.keys(roomGames).sort();
                if (gameNames.length > 1) {
                    searchAndFilterHtml += '<div class="rooms-game-filter">' +
                        '<select id="rooms-game-filter-select">' +
                            '<option value="">Todos os jogos</option>';
                    gameNames.forEach(function(gn) {
                        searchAndFilterHtml += '<option value="' + escapeHtml(gn) + '"' + (roomsGameFilter === gn ? ' selected' : '') + '>' + escapeHtml(gn) + '</option>';
                    });
                    searchAndFilterHtml += '</select></div>';
                }
            }
            searchAndFilterHtml += '</div>';
        }

        var contentHtml = '';

        if (roomsLoading) {
            contentHtml = '<div class="fm-loading"><div class="spinner"></div></div>';
        } else if (roomsTab === 'public') {
            var allRooms = (roomsData && roomsData.rooms) ? roomsData.rooms : [];
            var filteredRooms = allRooms;
            if (roomsGameFilter) {
                filteredRooms = filteredRooms.filter(function(r) {
                    var gt = r.game_title || (r.game ? r.game.title : '');
                    return gt === roomsGameFilter;
                });
            }
            if (roomsSearchQuery) {
                var sq = roomsSearchQuery.toLowerCase();
                filteredRooms = filteredRooms.filter(function(r) {
                    var title = (r.title || '').toLowerCase();
                    return title.indexOf(sq) !== -1;
                });
            }
            if (allRooms.length === 0) {
                contentHtml = '<div class="empty-state">' +
                    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>' +
                    '<p>' + I18n.t('rooms_empty') + '</p>' +
                    (isCmsLoggedIn() ? '<p style="font-size:12px;margin-top:4px">' + I18n.t('rooms_empty_create_hint') + '</p>' : '<p style="font-size:12px;margin-top:4px">' + I18n.t('rooms_empty_login_hint') + '</p>') +
                '</div>';
            } else if (filteredRooms.length === 0) {
                contentHtml = '<div class="empty-state"><p>' + (roomsSearchQuery ? I18n.t('rooms_no_results', {q: escapeHtml(roomsSearchQuery)}) : I18n.t('rooms_no_game_results')) + '</p></div>';
            } else {
                contentHtml = '<div class="rooms-list">';
                filteredRooms.forEach(function(room) {
                    contentHtml += renderRoomCard(room);
                });
                contentHtml += '</div>';
            }
        } else if (roomsTab === 'my') {
            if (!roomsMyData) {
                contentHtml = '<div class="fm-loading"><div class="spinner"></div></div>';
            } else {
                var createdRooms = roomsMyData.created || [];
                var participatingRooms = roomsMyData.participating || [];

                if (createdRooms.length === 0 && participatingRooms.length === 0) {
                    contentHtml = '<div class="empty-state">' +
                        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>' +
                        '<p>Você não tem salas</p><p style="font-size:12px;margin-top:4px">Crie ou entre em uma sala para começar</p>' +
                    '</div>';
                } else {
                    contentHtml = '';
                    if (createdRooms.length > 0) {
                        contentHtml += '<div class="section-title">Minhas Salas Criadas</div><div class="rooms-list">';
                        createdRooms.forEach(function(room) { contentHtml += renderRoomCard(room); });
                        contentHtml += '</div>';
                    }
                    if (participatingRooms.length > 0) {
                        contentHtml += '<div class="section-title">Salas que Participo</div><div class="rooms-list">';
                        participatingRooms.forEach(function(room) { contentHtml += renderRoomCard(room); });
                        contentHtml += '</div>';
                    }
                }
            }
        }

        el.innerHTML = headerHtml + tabsHtml + searchAndFilterHtml + contentHtml;

        var gameFilterSelect = el.querySelector('#rooms-game-filter-select');
        if (gameFilterSelect) {
            gameFilterSelect.addEventListener('change', function() {
                roomsGameFilter = this.value;
                renderRooms();
            });
        }

        el.querySelectorAll('[data-rooms-tab]').forEach(function(btn) {
            btn.addEventListener('click', function() {
                roomsTab = this.getAttribute('data-rooms-tab');
                roomsGameFilter = '';
                if (roomsTab === 'my' && !roomsMyData) {
                    loadMyRooms();
                }
                renderRooms();
            });
        });

        el.querySelectorAll('.room-card[data-room-id]').forEach(function(card) {
            card.addEventListener('click', function() {
                var roomId = this.getAttribute('data-room-id');
                loadRoomDetail(roomId);
            });
        });

        var createBtn = el.querySelector('#rooms-create-btn');
        if (createBtn) {
            createBtn.addEventListener('click', function() {
                roomsShowCreateForm = true;
                renderRooms();
            });
        }

        if (!roomsData && !roomsLoading) {
            loadPublicRooms();
        }
    }

    function loadPublicRooms() {
        roomsLoading = true;
        renderRooms();
        NovaAPI.getRooms({ upcoming: true }, function(err, data) {
            roomsLoading = false;
            if (!err && data) {
                roomsData = data;
            } else {
                roomsData = { rooms: [] };
            }
            if (state.currentPage === 'rooms') renderRooms();
        });
    }

    function loadMyRooms() {
        roomsMyData = null;
        renderRooms();
        NovaAPI.getMyRooms(function(err, data) {
            if (!err && data) {
                roomsMyData = data;
            } else {
                roomsMyData = { created: [], participating: [] };
            }
            if (state.currentPage === 'rooms') renderRooms();
        });
    }

    function loadRoomDetail(roomId) {
        roomsDetailRoom = null;
        roomsFriendIds = {};
        var pending = 2;
        var done = function() {
            pending--;
            if (pending <= 0 && state.currentPage === 'rooms') renderRooms();
        };
        NovaAPI.getRoom(roomId, function(err, data) {
            if (!err && data && data.room) {
                roomsDetailRoom = data.room;
            }
            done();
        });
        var pid = getCmsProfileId();
        if (pid) {
            NovaAPI.getFriendsList(pid, function(err, data) {
                if (!err && data) {
                    (data.friends || []).forEach(function(f) { roomsFriendIds[f.id] = 'friend'; });
                    (data.pending_requests || []).forEach(function(f) {
                        var req = f.requester || {};
                        if (req.id) roomsFriendIds[req.id] = 'pending';
                    });
                    (data.sent_requests || []).forEach(function(f) { roomsFriendIds[f.id] = 'sent'; });
                }
                done();
            });
        } else {
            done();
        }
    }

    function renderRoomDetail(el) {
        var room = roomsDetailRoom;
        if (!room) {
            el.innerHTML = '<div class="fm-loading"><div class="spinner"></div></div>';
            return;
        }

        var profileId = getCmsProfileId();
        var isCreator = profileId && room.creator_id === profileId;
        var participants = room.participants || [];
        var activeParticipants = participants.filter(function(p) { return p.status === 'joined' || p.status === 'confirmed'; });
        var isParticipant = participants.some(function(p) { return p.user_profile_id === profileId && (p.status === 'joined' || p.status === 'confirmed'); });
        var creatorName = room.creator ? (room.creator.display_name || room.creator.username) : 'Unknown';
        var gameTitle = room.game_title || (room.game ? room.game.title : '');
        var isFull = activeParticipants.length >= (room.max_players || 4);

        var backBtn = '<button class="back-btn" id="rooms-back-btn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><polyline points="15 18 9 12 15 6"/></svg> Voltar</button>';

        var html = backBtn +
            '<div class="room-detail-header">' +
                '<div class="room-detail-title">' + escapeHtml(room.title) + '</div>' +
                getRoomStatusBadge(room.status) +
            '</div>';

        html += '<div class="card" style="margin-top:12px">';
        if (gameTitle) {
            html += '<div class="room-detail-row"><span class="room-detail-label">Jogo</span><span>' + escapeHtml(gameTitle) + '</span></div>';
        }
        var detailServerBadge = room.server_type === 'stealth_server'
            ? '<span class="room-server-badge stealth">Servidor Stealth</span>'
            : '<span class="room-server-badge syslink">System Link</span>';
        html += '<div class="room-detail-row"><span class="room-detail-label">Host</span><span>' + escapeHtml(creatorName) + '</span></div>' +
            '<div class="room-detail-row"><span class="room-detail-label">Servidor</span><span>' + detailServerBadge + '</span></div>' +
            '<div class="room-detail-row"><span class="room-detail-label">Jogadores</span><span>' + activeParticipants.length + '/' + (room.max_players || 4) + '</span></div>' +
            '<div class="room-detail-row"><span class="room-detail-label">Tipo</span><span>' + (room.is_public ? 'Pública' : 'Privada') + '</span></div>';
        if (room.scheduled_at) {
            html += '<div class="room-detail-row"><span class="room-detail-label">Horário</span><span>' + formatRoomTime(room.scheduled_at, room.timezone) + '</span></div>' +
                '<div class="room-detail-row"><span class="room-detail-label">Countdown</span><span class="room-countdown-detail">' + formatRoomCountdown(room.scheduled_at) + '</span></div>';
        }
        html += '</div>';

        if (isCmsLoggedIn() && room.status !== 'cancelled' && room.status !== 'finished') {
            html += '<div class="room-detail-actions">';
            if (!isParticipant && !isCreator && !isFull) {
                html += '<button class="btn btn-primary" id="room-join-btn">Entrar na Sala</button>';
            } else if (isParticipant && !isCreator) {
                html += '<button class="btn btn-secondary" id="room-leave-btn">Sair da Sala</button>';
            }
            if (isCreator) {
                html += '<button class="btn btn-secondary" id="room-edit-btn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" style="vertical-align:-2px"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Editar</button>';
                html += '<button class="btn" style="background:rgba(16,185,129,0.15);color:var(--success);border:1px solid rgba(16,185,129,0.2)" id="room-finish-btn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" style="vertical-align:-2px"><polyline points="20 6 9 17 4 12"/></svg> Concluir</button>';
                html += '<button class="btn btn-secondary" id="room-invite-btn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" style="vertical-align:-2px"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg> Convidar Amigos</button>';
                html += '<button class="btn" style="background:rgba(239,68,68,0.15);color:var(--danger);border:1px solid rgba(239,68,68,0.2)" id="room-cancel-btn">Cancelar Sala</button>';
            }
            html += '</div>';
        }

        html += '<div class="section-title">Participantes (' + activeParticipants.length + ')</div>' +
            '<div class="room-participants-list">';
        participants.forEach(function(p) {
            if (p.status !== 'joined' && p.status !== 'confirmed' && p.status !== 'invited') return;
            var up = p.userProfile || p.user_profile || {};
            var pName = up.display_name || up.username || 'Unknown';
            var initial = (pName[0] || '?').toUpperCase();
            var statusLabel = p.status === 'invited' ? ' <span class="badge" style="background:rgba(245,158,11,0.15);color:var(--warning);font-size:9px">Convidado</span>' : '';
            var isHost = room.creator_id === up.id;

            html += '<div class="room-participant-item">' +
                '<div class="room-participant-avatar">';
            if (up.avatar_url) {
                html += '<img src="' + escapeHtml(up.avatar_url) + '" alt="" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'">' +
                    '<div class="room-avatar-fallback" style="display:none;width:36px;height:36px;font-size:14px">' + escapeHtml(initial) + '</div>';
            } else {
                html += '<div class="room-avatar-fallback" style="width:36px;height:36px;font-size:14px">' + escapeHtml(initial) + '</div>';
            }
            var canAddFriend = isCmsLoggedIn() && up.id && up.id !== profileId && !roomsFriendIds[up.id];
            var friendState = roomsFriendIds[up.id];
            var friendBadge = '';
            if (friendState === 'friend') {
                friendBadge = '<span class="badge" style="background:rgba(16,185,129,0.15);color:var(--success);font-size:9px;margin-left:4px">Amigo</span>';
            } else if (friendState === 'pending' || friendState === 'sent') {
                friendBadge = '<span class="badge" style="background:rgba(245,158,11,0.15);color:var(--warning);font-size:9px;margin-left:4px">Pendente</span>';
            }
            html += '</div>' +
                '<div class="room-participant-info">' +
                    '<div class="room-participant-name">' + escapeHtml(pName) + (isHost ? ' <span class="room-crown-badge" title="Criador da sala"><svg viewBox="0 0 24 24" fill="var(--warning)" stroke="var(--warning)" stroke-width="1" width="14" height="14"><path d="M2 20h20l-2-14-5 7-3-8-3 8-5-7-2 14z"/><rect x="2" y="20" width="20" height="2" rx="1"/></svg></span>' : '') + statusLabel + friendBadge + '</div>' +
                '</div>' +
                (canAddFriend ? '<button class="btn btn-sm room-add-friend-btn" data-add-friend-id="' + up.id + '" title="Adicionar amigo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg></button>' : '') +
            '</div>';
        });
        html += '</div>';

        html += '<div id="room-edit-section" class="hidden"></div>';

        html += '<div id="room-invite-section" class="hidden"></div>';

        if (isParticipant || isCreator) {
            var roomClosed = room.status === 'finished' || room.status === 'cancelled';
            html += '<div class="section-title">Chat</div>' +
                '<div class="room-chat-container">' +
                    '<div class="room-chat-messages" id="room-chat-messages"></div>' +
                    (roomClosed ? '' :
                    '<div class="room-chat-input-area">' +
                        '<input type="text" class="room-chat-input" id="room-chat-input" placeholder="Digite sua mensagem..." maxlength="1000">' +
                        '<button class="btn btn-primary room-chat-send-btn" id="room-chat-send">Enviar</button>' +
                    '</div>') +
                '</div>';
        }

        el.innerHTML = html;

        if (isParticipant || isCreator) {
            roomChatLastId = 0;
            loadRoomMessages(room.id, false);
            startRoomChatPoll(room.id);

            var chatInput = el.querySelector('#room-chat-input');
            var chatSendBtn = el.querySelector('#room-chat-send');
            if (chatSendBtn && chatInput) {
                chatSendBtn.addEventListener('click', function() {
                    sendRoomChatMessage(room.id);
                });
                chatInput.addEventListener('keydown', function(e) {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendRoomChatMessage(room.id);
                    }
                });
            }
        }

        var backBtnEl = el.querySelector('#rooms-back-btn');
        if (backBtnEl) {
            backBtnEl.addEventListener('click', function() {
                stopRoomChatPoll();
                roomsDetailRoom = null;
                roomsData = null;
                loadPublicRooms();
            });
        }

        var joinBtn = el.querySelector('#room-join-btn');
        if (joinBtn) {
            joinBtn.addEventListener('click', function() {
                joinBtn.disabled = true;
                joinBtn.textContent = 'Entrando...';
                NovaAPI.joinRoom(room.id, function(err) {
                    if (err) {
                        joinBtn.disabled = false;
                        joinBtn.textContent = 'Erro: ' + err.message;
                        setTimeout(function() { joinBtn.textContent = 'Entrar na Sala'; }, 2000);
                    } else {
                        loadRoomDetail(room.id);
                    }
                });
            });
        }

        var leaveBtn = el.querySelector('#room-leave-btn');
        if (leaveBtn) {
            leaveBtn.addEventListener('click', function() {
                if (!confirm('Sair desta sala?')) return;
                leaveBtn.disabled = true;
                leaveBtn.textContent = 'Saindo...';
                NovaAPI.leaveRoom(room.id, function(err) {
                    if (err) {
                        leaveBtn.disabled = false;
                        leaveBtn.textContent = 'Erro';
                        setTimeout(function() { leaveBtn.textContent = 'Sair da Sala'; }, 2000);
                    } else {
                        loadRoomDetail(room.id);
                    }
                });
            });
        }

        var cancelBtn = el.querySelector('#room-cancel-btn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', function() {
                if (!confirm('Tem certeza que deseja cancelar esta sala?')) return;
                cancelBtn.disabled = true;
                cancelBtn.textContent = 'Cancelando...';
                var cmsUrl = NovaAPI.getCmsUrl();
                var token = NovaAPI.getCmsAuthToken();
                var xhr = new XMLHttpRequest();
                xhr.open('DELETE', cmsUrl + '/api/rooms/' + room.id, true);
                xhr.setRequestHeader('Authorization', 'Bearer ' + token);
                xhr.timeout = 15000;
                xhr.onload = function() {
                    loadRoomDetail(room.id);
                };
                xhr.onerror = function() { cancelBtn.textContent = 'Erro'; };
                xhr.send();
            });
        }

        var finishBtn = el.querySelector('#room-finish-btn');
        if (finishBtn) {
            finishBtn.addEventListener('click', function() {
                if (!confirm('Concluir esta sala? Ela será marcada como finalizada.')) return;
                finishBtn.disabled = true;
                finishBtn.textContent = 'Concluindo...';
                NovaAPI.finishRoom(room.id, function(err) {
                    if (err) {
                        finishBtn.disabled = false;
                        finishBtn.textContent = 'Erro: ' + err.message;
                        setTimeout(function() { finishBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" style="vertical-align:-2px"><polyline points="20 6 9 17 4 12"/></svg> Concluir'; }, 2000);
                    } else {
                        loadRoomDetail(room.id);
                    }
                });
            });
        }

        var editBtn = el.querySelector('#room-edit-btn');
        if (editBtn) {
            editBtn.addEventListener('click', function() {
                var editSection = el.querySelector('#room-edit-section');
                if (!editSection) return;
                if (!editSection.classList.contains('hidden')) {
                    editSection.classList.add('hidden');
                    return;
                }
                editSection.classList.remove('hidden');
                editSection.innerHTML =
                    '<div class="card" style="margin-top:12px">' +
                        '<div class="section-title" style="margin-top:0">Editar Sala</div>' +
                        '<div class="room-edit-form">' +
                            '<div class="room-edit-field">' +
                                '<label>Título</label>' +
                                '<input type="text" id="room-edit-title" value="' + escapeHtml(room.title) + '" maxlength="255">' +
                            '</div>' +
                            '<div class="room-edit-field">' +
                                '<label>Máx. Jogadores</label>' +
                                '<input type="number" id="room-edit-max-players" value="' + (room.max_players || 4) + '" min="2" max="32">' +
                            '</div>' +
                            '<div class="room-edit-field">' +
                                '<label style="display:flex;align-items:center;gap:8px;cursor:pointer">' +
                                    '<input type="checkbox" id="room-edit-is-public"' + (room.is_public ? ' checked' : '') + '> Sala Pública' +
                                '</label>' +
                            '</div>' +
                            '<div class="room-edit-actions">' +
                                '<button class="btn btn-primary btn-sm" id="room-edit-save">Salvar</button>' +
                                '<button class="btn btn-secondary btn-sm" id="room-edit-cancel-btn">Cancelar</button>' +
                            '</div>' +
                            '<p id="room-edit-error" class="hidden" style="color:var(--danger);font-size:12px;margin-top:8px"></p>' +
                        '</div>' +
                    '</div>';

                var editCancelBtn = editSection.querySelector('#room-edit-cancel-btn');
                if (editCancelBtn) {
                    editCancelBtn.addEventListener('click', function() {
                        editSection.classList.add('hidden');
                    });
                }

                var editSaveBtn = editSection.querySelector('#room-edit-save');
                if (editSaveBtn) {
                    editSaveBtn.addEventListener('click', function() {
                        var newTitle = editSection.querySelector('#room-edit-title').value.trim();
                        var newMaxPlayers = parseInt(editSection.querySelector('#room-edit-max-players').value) || 4;
                        var newIsPublic = editSection.querySelector('#room-edit-is-public').checked;
                        var editError = editSection.querySelector('#room-edit-error');

                        if (!newTitle) {
                            editError.textContent = 'Título é obrigatório';
                            editError.classList.remove('hidden');
                            return;
                        }

                        editSaveBtn.disabled = true;
                        editSaveBtn.textContent = 'Salvando...';
                        editError.classList.add('hidden');

                        NovaAPI.updateRoom(room.id, {
                            title: newTitle,
                            max_players: newMaxPlayers,
                            is_public: newIsPublic
                        }, function(err) {
                            if (err) {
                                editSaveBtn.disabled = false;
                                editSaveBtn.textContent = 'Salvar';
                                editError.textContent = err.message;
                                editError.classList.remove('hidden');
                            } else {
                                loadRoomDetail(room.id);
                            }
                        });
                    });
                }
            });
        }

        var inviteBtn = el.querySelector('#room-invite-btn');
        if (inviteBtn) {
            inviteBtn.addEventListener('click', function() {
                var inviteSection = el.querySelector('#room-invite-section');
                if (!inviteSection) return;
                if (!inviteSection.classList.contains('hidden')) {
                    inviteSection.classList.add('hidden');
                    return;
                }
                inviteSection.classList.remove('hidden');
                inviteSection.innerHTML = '<div class="fm-loading"><div class="spinner"></div></div>';

                NovaAPI.getFriendsList(profileId, function(err, data) {
                    if (err || !data) {
                        inviteSection.innerHTML = '<div class="card" style="padding:12px;font-size:13px;color:var(--text-muted)">Não foi possível carregar amigos</div>';
                        return;
                    }

                    var friends = data.friends || [];
                    if (friends.length === 0) {
                        inviteSection.innerHTML = '<div class="card" style="padding:12px;font-size:13px;color:var(--text-muted)">Você não tem amigos para convidar</div>';
                        return;
                    }

                    var existingIds = {};
                    participants.forEach(function(p) { existingIds[p.user_profile_id] = true; });

                    var availableFriends = friends.filter(function(f) {
                        var fId = f.id || (f.friend ? f.friend.id : null);
                        return fId && !existingIds[fId];
                    });

                    if (availableFriends.length === 0) {
                        inviteSection.innerHTML = '<div class="card" style="padding:12px;font-size:13px;color:var(--text-muted)">Todos os amigos já estão na sala</div>';
                        return;
                    }

                    var friendHtml = '<div class="section-title">Convidar Amigos</div><div class="room-invite-list">';
                    availableFriends.forEach(function(f) {
                        var friend = f.friend || f;
                        var fName = friend.display_name || friend.username || 'Unknown';
                        var fId = friend.id;
                        friendHtml += '<div class="room-invite-friend" data-invite-id="' + fId + '">' +
                            '<span>' + escapeHtml(fName) + '</span>' +
                            '<button class="btn btn-sm btn-primary room-invite-friend-btn" data-invite-friend="' + fId + '">Convidar</button>' +
                        '</div>';
                    });
                    friendHtml += '</div>';
                    inviteSection.innerHTML = friendHtml;

                    inviteSection.querySelectorAll('.room-invite-friend-btn').forEach(function(btn) {
                        btn.addEventListener('click', function() {
                            var fId = parseInt(this.getAttribute('data-invite-friend'));
                            this.disabled = true;
                            this.textContent = 'Enviando...';
                            var btnRef = this;
                            NovaAPI.inviteFriends(room.id, [fId], function(err2) {
                                if (err2) {
                                    btnRef.textContent = 'Erro';
                                } else {
                                    btnRef.textContent = 'Enviado!';
                                    btnRef.style.background = 'var(--success)';
                                }
                            });
                        });
                    });
                });
            });
        }

        el.querySelectorAll('.room-add-friend-btn').forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                var targetId = parseInt(this.getAttribute('data-add-friend-id'));
                this.disabled = true;
                var btnRef = this;
                NovaAPI.sendFriendRequest(targetId, function(err2) {
                    if (err2) {
                        btnRef.innerHTML = '<span style="font-size:10px">' + escapeHtml(err2.message).substring(0, 20) + '</span>';
                        btnRef.style.color = 'var(--danger)';
                    } else {
                        btnRef.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="20 6 9 17 4 12"/></svg>';
                        btnRef.style.color = 'var(--success)';
                    }
                });
            });
        });
    }

    function stopRoomChatPoll() {
        if (roomChatPollInterval) {
            clearInterval(roomChatPollInterval);
            roomChatPollInterval = null;
        }
    }

    function startRoomChatPoll(roomId) {
        stopRoomChatPoll();
        roomChatPollInterval = setInterval(function() {
            if (state.currentPage !== 'rooms' || !roomsDetailRoom || roomsDetailRoom.id !== roomId) {
                stopRoomChatPoll();
                return;
            }
            loadRoomMessages(roomId, true);
        }, 5000);
    }

    function loadRoomMessages(roomId, isPolling) {
        var afterId = isPolling ? roomChatLastId : 0;
        NovaAPI.getRoomMessages(roomId, afterId, function(err, data) {
            if (err || !data || !data.messages) return;
            var msgs = data.messages;
            if (msgs.length === 0 && isPolling) return;
            var container = document.getElementById('room-chat-messages');
            if (!container) return;

            if (!isPolling) {
                container.innerHTML = '';
                roomChatLastId = 0;
            }

            var profileId = getCmsProfileId();
            msgs.forEach(function(msg) {
                var up = msg.userProfile || {};
                var name = up.display_name || up.username || 'Unknown';
                var initial = (name[0] || '?').toUpperCase();
                var isMine = up.id === profileId;
                var time = '';
                try {
                    var d = new Date(msg.createdAt);
                    time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                } catch(e) {}

                var msgEl = document.createElement('div');
                msgEl.className = 'room-chat-msg' + (isMine ? ' room-chat-msg-mine' : '');
                msgEl.innerHTML =
                    '<div class="room-chat-msg-avatar">' +
                        (up.avatar_url ? '<img src="' + escapeHtml(up.avatar_url) + '" alt="" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'">' +
                            '<div class="room-avatar-fallback" style="display:none;width:28px;height:28px;font-size:11px">' + escapeHtml(initial) + '</div>' :
                            '<div class="room-avatar-fallback" style="width:28px;height:28px;font-size:11px">' + escapeHtml(initial) + '</div>') +
                    '</div>' +
                    '<div class="room-chat-msg-content">' +
                        '<div class="room-chat-msg-header">' +
                            '<span class="room-chat-msg-name">' + escapeHtml(name) + '</span>' +
                            '<span class="room-chat-msg-time">' + time + '</span>' +
                        '</div>' +
                        '<div class="room-chat-msg-text">' + escapeHtml(msg.message) + '</div>' +
                    '</div>';
                container.appendChild(msgEl);

                if (msg.id > roomChatLastId) roomChatLastId = msg.id;
            });

            if (msgs.length > 0) {
                container.scrollTop = container.scrollHeight;
            }

            if (!isPolling && msgs.length === 0) {
                container.innerHTML = '<div class="room-chat-empty">Nenhuma mensagem ainda. Comece a conversa!</div>';
            }
        });
    }

    function sendRoomChatMessage(roomId) {
        var input = document.getElementById('room-chat-input');
        if (!input) return;
        var text = input.value.trim();
        if (!text) return;
        input.value = '';
        var sendBtn = document.getElementById('room-chat-send');
        if (sendBtn) sendBtn.disabled = true;

        NovaAPI.sendRoomMessage(roomId, text, function(err, data) {
            if (sendBtn) sendBtn.disabled = false;
            if (err) {
                input.value = text;
                return;
            }
            if (data && data.message) {
                var container = document.getElementById('room-chat-messages');
                if (!container) return;

                var emptyMsg = container.querySelector('.room-chat-empty');
                if (emptyMsg) emptyMsg.remove();

                var msg = data.message;
                var up = msg.userProfile || {};
                var name = up.display_name || up.username || 'Unknown';
                var initial = (name[0] || '?').toUpperCase();
                var time = '';
                try {
                    var d = new Date(msg.createdAt);
                    time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                } catch(e) {}

                var msgEl = document.createElement('div');
                msgEl.className = 'room-chat-msg room-chat-msg-mine';
                msgEl.innerHTML =
                    '<div class="room-chat-msg-avatar">' +
                        (up.avatar_url ? '<img src="' + escapeHtml(up.avatar_url) + '" alt="" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'">' +
                            '<div class="room-avatar-fallback" style="display:none;width:28px;height:28px;font-size:11px">' + escapeHtml(initial) + '</div>' :
                            '<div class="room-avatar-fallback" style="width:28px;height:28px;font-size:11px">' + escapeHtml(initial) + '</div>') +
                    '</div>' +
                    '<div class="room-chat-msg-content">' +
                        '<div class="room-chat-msg-header">' +
                            '<span class="room-chat-msg-name">' + escapeHtml(name) + '</span>' +
                            '<span class="room-chat-msg-time">' + time + '</span>' +
                        '</div>' +
                        '<div class="room-chat-msg-text">' + escapeHtml(msg.message) + '</div>' +
                    '</div>';
                container.appendChild(msgEl);
                container.scrollTop = container.scrollHeight;

                if (msg.id > roomChatLastId) roomChatLastId = msg.id;
            }
            input.focus();
        });
    }

    function renderRoomCreateForm(el) {
        var backBtn = '<button class="back-btn" id="rooms-create-back"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><polyline points="15 18 9 12 15 6"/></svg> Voltar</button>';

        var gameOptions = '<option value="">Selecionar jogo (opcional)</option>';
        state.games.forEach(function(g) {
            var name = getGameName(g);
            var id = g.id || '';
            if (name) {
                gameOptions += '<option value="' + escapeHtml(String(id)) + '" data-game-title="' + escapeHtml(name) + '">' + escapeHtml(name) + '</option>';
            }
        });

        var now = new Date();
        now.setMinutes(now.getMinutes() + 30);
        var defaultTime = now.toISOString().slice(0, 16);

        var html = backBtn +
            '<div class="page-header" style="padding-top:8px"><div class="page-title">' + I18n.t('rooms_form_title') + '</div></div>' +
            '<form id="room-create-form" class="room-create-form">' +
                '<div class="room-form-field">' +
                    '<label>' + I18n.t('rooms_form_name') + '</label>' +
                    '<input type="text" id="room-form-title" placeholder="' + I18n.t('rooms_form_name_placeholder') + '" required maxlength="100">' +
                '</div>' +
                '<div class="room-form-field">' +
                    '<label>' + I18n.t('rooms_form_game') + '</label>' +
                    '<select id="room-form-game">' + gameOptions + '</select>' +
                '</div>' +
                '<div class="room-form-field">' +
                    '<label>' + I18n.t('rooms_form_datetime') + '</label>' +
                    '<input type="datetime-local" id="room-form-time" value="' + defaultTime + '">' +
                '</div>' +
                '<div class="room-form-field">' +
                    '<label>' + I18n.t('rooms_form_server_type') + '</label>' +
                    '<select id="room-form-server-type">' +
                        '<option value="system_link">' + I18n.t('rooms_form_server_system_link') + '</option>' +
                        '<option value="stealth_server">' + I18n.t('rooms_form_server_stealth') + '</option>' +
                    '</select>' +
                '</div>' +
                '<div class="room-form-row">' +
                    '<div class="room-form-field" style="flex:1">' +
                        '<label>' + I18n.t('rooms_form_max_players') + '</label>' +
                        '<input type="number" id="room-form-max" value="4" min="2" max="16">' +
                    '</div>' +
                    '<div class="room-form-field" style="flex:1">' +
                        '<label>' + I18n.t('rooms_form_visibility') + '</label>' +
                        '<select id="room-form-public">' +
                            '<option value="true">' + I18n.t('rooms_form_public') + '</option>' +
                            '<option value="false">' + I18n.t('rooms_form_private') + '</option>' +
                        '</select>' +
                    '</div>' +
                '</div>' +
                '<div class="room-form-field">' +
                    '<label>' + I18n.t('rooms_form_language') + '</label>' +
                    '<select id="room-form-language">' +
                        '<option value="">' + I18n.t('rooms_lang_any') + '</option>' +
                        '<option value="pt">🇧🇷 Português</option>' +
                        '<option value="en">🇺🇸 English</option>' +
                        '<option value="es">🇪🇸 Español</option>' +
                    '</select>' +
                '</div>' +
                '<p id="room-create-error" class="cms-login-error hidden"></p>' +
                '<button type="submit" class="btn btn-primary btn-block" id="room-create-submit">' +
                    '<span id="room-create-btn-text">' + I18n.t('rooms_form_submit') + '</span>' +
                    '<div id="room-create-spinner" class="loader-spinner small hidden"></div>' +
                '</button>' +
            '</form>';

        el.innerHTML = html;

        el.querySelector('#rooms-create-back').addEventListener('click', function() {
            roomsShowCreateForm = false;
            renderRooms();
        });

        el.querySelector('#room-create-form').addEventListener('submit', function(e) {
            e.preventDefault();
            var title = el.querySelector('#room-form-title').value.trim();
            var gameSelect = el.querySelector('#room-form-game');
            var gameId = gameSelect.value || null;
            var gameTitle = '';
            if (gameSelect.selectedIndex > 0) {
                gameTitle = gameSelect.options[gameSelect.selectedIndex].getAttribute('data-game-title') || '';
            }
            var scheduledAt = el.querySelector('#room-form-time').value;
            var serverType = el.querySelector('#room-form-server-type').value;
            var maxPlayers = parseInt(el.querySelector('#room-form-max').value) || 4;
            var isPublic = el.querySelector('#room-form-public').value === 'true';
            var roomLang = (el.querySelector('#room-form-language') || {}).value || '';
            var errorEl = el.querySelector('#room-create-error');
            var btnText = el.querySelector('#room-create-btn-text');
            var spinner = el.querySelector('#room-create-spinner');
            var submitBtn = el.querySelector('#room-create-submit');

            if (!title) {
                show(errorEl);
                errorEl.textContent = I18n.t('rooms_form_name_required');
                return;
            }

            hide(errorEl);
            hide(btnText);
            show(spinner);
            submitBtn.disabled = true;

            var data = {
                title: title,
                game_id: gameId ? parseInt(gameId) : null,
                game_title: gameTitle || null,
                scheduled_at: scheduledAt || null,
                timezone: getUserTimezone(),
                max_players: maxPlayers,
                is_public: isPublic,
                server_type: serverType,
                language: roomLang || null
            };

            NovaAPI.createRoom(data, function(err, resp) {
                show(btnText);
                hide(spinner);
                submitBtn.disabled = false;

                if (err) {
                    show(errorEl);
                    errorEl.textContent = err.message || 'Erro ao criar sala';
                    return;
                }

                roomsShowCreateForm = false;
                roomsData = null;
                if (resp && resp.room) {
                    roomsDetailRoom = resp.room;
                }
                renderRooms();
            });
        });
    }

    function extractTitleIdFromFilename(fname) {
        if (!fname) return '';
        var upper = String(fname).toUpperCase();
        var m = upper.match(/([0-9A-F]{8})/);
        return m ? m[1] : '';
    }

    function getScreenshotGameMap(allScreenshots) {
        var tidMap = {};
        allScreenshots.forEach(function(s) {
            var fname = s.filename || s.uuid || s || '';
            var tid = extractTitleIdFromFilename(fname);
            if (tid && tid !== '00000000') {
                if (!tidMap[tid]) tidMap[tid] = { tid: tid, count: 0, name: '' };
                tidMap[tid].count++;
            }
        });
        Object.keys(tidMap).forEach(function(tid) {
            var game = state.games.find(function(g) {
                var gid = getGameId(g);
                return gid && gid.replace(/^0x/i, '').toUpperCase() === tid;
            });
            if (game) tidMap[tid].name = getGameName(game);
        });
        return tidMap;
    }

    var SCREENS_PER_PAGE = 12;
    var screensPage = (function() {
        try { var v = parseInt(localStorage.getItem('nova_screens_page')); return isNaN(v) || v < 1 ? 1 : v; } catch(e) { return 1; }
    })();

    function screensGetPref(key, def) {
        try { var v = localStorage.getItem(key); return v !== null ? v : def; } catch(e) { return def; }
    }
    function screensSetPref(key, val) {
        try { localStorage.setItem(key, val); } catch(e) {}
    }

    function screensParseDate(uuid) {
        var s = String(uuid);
        var hexPrefix = s.match(/^[0-9A-Fa-f]{8}/);
        if (hexPrefix) {
            var rest = s.substring(8);
            var m = rest.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/);
            if (m) {
                return new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]), parseInt(m[4]), parseInt(m[5]), parseInt(m[6]));
            }
        }
        var m2 = s.match(/(\d{4})(\d{2})(\d{2})[\-_]?(\d{2})(\d{2})(\d{2})/);
        if (m2) {
            return new Date(parseInt(m2[1]), parseInt(m2[2]) - 1, parseInt(m2[3]), parseInt(m2[4]), parseInt(m2[5]), parseInt(m2[6]));
        }
        return null;
    }

    function screensFormatDate(d) {
        if (!d || isNaN(d.getTime())) return '---';
        var dd = String(d.getDate()).padStart(2, '0');
        var mm = String(d.getMonth() + 1).padStart(2, '0');
        var yy = d.getFullYear();
        var hh = String(d.getHours()).padStart(2, '0');
        var mi = String(d.getMinutes()).padStart(2, '0');
        return dd + '/' + mm + '/' + yy + ' ' + hh + ':' + mi;
    }

    function screensBuildPagination(currentPage, totalPages, cssClass) {
        if (totalPages <= 1) return '';
        var html = '<div class="screens-pagination ' + cssClass + '">';
        html += '<button class="screens-pg-btn" data-page="1"' + (currentPage <= 1 ? ' disabled' : '') + '>&laquo;</button>';
        html += '<button class="screens-pg-btn" data-page="' + (currentPage - 1) + '"' + (currentPage <= 1 ? ' disabled' : '') + '>&lsaquo;</button>';
        var startP = Math.max(1, currentPage - 2);
        var endP = Math.min(totalPages, currentPage + 2);
        if (startP > 1) {
            html += '<button class="screens-pg-btn" data-page="1">1</button>';
            if (startP > 2) html += '<span class="screens-pg-ellipsis">…</span>';
        }
        for (var p = startP; p <= endP; p++) {
            html += '<button class="screens-pg-btn' + (p === currentPage ? ' active' : '') + '" data-page="' + p + '">' + p + '</button>';
        }
        if (endP < totalPages) {
            if (endP < totalPages - 1) html += '<span class="screens-pg-ellipsis">…</span>';
            html += '<button class="screens-pg-btn" data-page="' + totalPages + '">' + totalPages + '</button>';
        }
        html += '<button class="screens-pg-btn" data-page="' + (currentPage + 1) + '"' + (currentPage >= totalPages ? ' disabled' : '') + '>&rsaquo;</button>';
        html += '<button class="screens-pg-btn" data-page="' + totalPages + '"' + (currentPage >= totalPages ? ' disabled' : '') + '>&raquo;</button>';
        html += '</div>';
        return html;
    }

    function renderScreens() {
        var el = $('#page-screens');

        var allScreenshots = state.screenshots || [];
        var currentTitleId = state.title ? (state.title.titleid || state.title.TitleId || '') : '';
        var currentCleanTid = currentTitleId ? currentTitleId.replace(/^0x/i, '').toUpperCase() : '';
        var hasCurrent = currentCleanTid && !isDashboard(state.title);

        var tidMap = getScreenshotGameMap(allScreenshots);

        if (screensFilterTid && !tidMap[screensFilterTid]) {
            screensFilterTid = null;
        }

        var displayScreenshots = allScreenshots;
        if (screensFilterTid) {
            displayScreenshots = allScreenshots.filter(function(s) {
                var fname = (s.filename || s.uuid || s || '').toUpperCase();
                return fname.indexOf(screensFilterTid) !== -1;
            });
        }

        var viewMode = screensGetPref('nova_screens_view_mode', 'grid');
        var sortOrder = screensGetPref('nova_screens_sort_order', 'newest');

        var sorted = displayScreenshots.slice();
        sorted.sort(function(a, b) {
            var fa = String(a.filename || a.uuid || a);
            var fb = String(b.filename || b.uuid || b);
            var da = screensParseDate(fa);
            var db = screensParseDate(fb);
            if (da && db) {
                return db.getTime() - da.getTime();
            }
            return fb.localeCompare(fa);
        });
        if (sortOrder === 'oldest') {
            sorted.reverse();
        }

        var totalPages = Math.max(1, Math.ceil(sorted.length / SCREENS_PER_PAGE));
        if (screensPage > totalPages) screensPage = totalPages;
        if (screensPage < 1) screensPage = 1;
        var pageStart = (screensPage - 1) * SCREENS_PER_PAGE;
        var pageItems = sorted.slice(pageStart, pageStart + SCREENS_PER_PAGE);

        var filterHtml = '';
        var gameKeys = Object.keys(tidMap);
        if (gameKeys.length > 0 || hasCurrent) {
            filterHtml = '<div class="screens-filter-bar">';
            filterHtml += '<button class="screens-filter-btn' + (!screensFilterTid ? ' active' : '') + '" data-screens-tid="">Tudo (' + allScreenshots.length + ')</button>';
            if (hasCurrent && tidMap[currentCleanTid]) {
                var currentGame = findGameByTitleId(currentTitleId);
                var currentLabel = currentGame ? getGameName(currentGame) : 'Este Jogo';
                filterHtml += '<button class="screens-filter-btn' + (screensFilterTid === currentCleanTid ? ' active' : '') + '" data-screens-tid="' + currentCleanTid + '">' + escapeHtml(currentLabel) + ' (' + tidMap[currentCleanTid].count + ')</button>';
            }
            gameKeys.sort(function(a, b) {
                var na = tidMap[a].name || a;
                var nb = tidMap[b].name || b;
                return na.localeCompare(nb);
            });
            gameKeys.forEach(function(tid) {
                if (hasCurrent && tid === currentCleanTid) return;
                var info = tidMap[tid];
                var label = info.name || ('0x' + tid);
                filterHtml += '<button class="screens-filter-btn' + (screensFilterTid === tid ? ' active' : '') + '" data-screens-tid="' + tid + '">' + escapeHtml(label) + ' (' + info.count + ')</button>';
            });
            filterHtml += '</div>';
        }

        var gridIconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>';
        var listIconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>';

        var headerHtml = '<div class="page-header">' +
            '<div><div class="page-title">Screenshots</div><div class="page-subtitle">' + sorted.length + ' captures</div></div>' +
            '<div class="screens-header-actions">' +
                '<button class="take-screenshot-btn" id="take-screenshot-btn">' +
                    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>' +
                    ' Capturar' +
                '</button>' +
            '</div>' +
        '</div>';

        var toolbarHtml = '<div class="screens-toolbar">' +
            '<div class="screens-toolbar-left">' +
                '<select class="screens-sort-select" id="screens-sort-select">' +
                    '<option value="newest"' + (sortOrder === 'newest' ? ' selected' : '') + '>Mais recentes</option>' +
                    '<option value="oldest"' + (sortOrder === 'oldest' ? ' selected' : '') + '>Mais antigas</option>' +
                '</select>' +
            '</div>' +
            '<div class="screens-toolbar-right">' +
                '<button class="screens-view-btn' + (viewMode === 'grid' ? ' active' : '') + '" data-view="grid" title="Grade">' + gridIconSvg + '</button>' +
                '<button class="screens-view-btn' + (viewMode === 'list' ? ' active' : '') + '" data-view="list" title="Lista">' + listIconSvg + '</button>' +
            '</div>' +
        '</div>';

        if (sorted.length === 0) {
            el.innerHTML = headerHtml + filterHtml +
                '<div class="empty-state">' +
                    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>' +
                    '<p>Nenhuma screenshot</p><p style="font-size:12px;margin-top:4px">Pressione "Capturar" para tirar uma screenshot</p>' +
                '</div>';
            bindTakeScreenshot();
            bindScreensFilter();
            return;
        }

        var paginationTop = screensBuildPagination(screensPage, totalPages, 'screens-pagination-top');
        var paginationBottom = screensBuildPagination(screensPage, totalPages, 'screens-pagination-bottom');

        var html = headerHtml + filterHtml + toolbarHtml;

        if (viewMode === 'grid') {
            html += paginationTop;

            var progressTotal = pageItems.length;

            if (progressTotal > 0) {
                html += '<div class="screens-progress-wrap" id="screens-progress-wrap">' +
                    '<div class="screens-progress-bar"><div class="screens-progress-fill" id="screens-progress-fill"></div></div>' +
                    '<div class="screens-progress-text" id="screens-progress-text">Carregando 0 / ' + progressTotal + '</div>' +
                '</div>';
            }

            html += '<div class="screenshots-grid">';
            pageItems.forEach(function(s) {
                var uuid = s.filename || s.uuid || s;
                var imgUrl = NovaAPI.getScreencaptureUrl(uuid);

                html += '<div class="screenshot-item" data-uuid="' + escapeHtml(uuid) + '">' +
                    '<div class="screenshot-loader"><div class="spinner"></div></div>' +
                    '<img data-auth-src="' + escapeHtml(imgUrl) + '" alt="Screenshot" style="display:none">' +
                    '<div class="screenshot-actions">' +
                        '<button class="screenshot-delete" data-uuid="' + escapeHtml(uuid) + '" title="Excluir" onclick="event.stopPropagation()">' +
                            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>' +
                        '</button>' +
                        '<button class="screenshot-download" data-url="' + escapeHtml(imgUrl) + '" data-filename="screenshot_' + escapeHtml(uuid) + '.bmp" title="Baixar" onclick="event.stopPropagation()">' +
                            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>' +
                        '</button>' +
                    '</div>' +
                '</div>';
            });
            html += '</div>';

        } else {
            html += paginationTop;
            html += '<div class="screens-list">';
            html += '<div class="screens-list-header">' +
                '<span class="screens-list-col-name">Arquivo</span>' +
                '<span class="screens-list-col-date">Data</span>' +
                '<span class="screens-list-col-actions">Ações</span>' +
            '</div>';
            pageItems.forEach(function(s) {
                var uuid = s.filename || s.uuid || s;
                var imgUrl = NovaAPI.getScreencaptureUrl(uuid);
                var d = screensParseDate(uuid);
                var dateStr = screensFormatDate(d);
                var shortName = String(uuid).length > 35 ? String(uuid).substring(0, 32) + '...' : String(uuid);
                html += '<div class="screens-list-row" data-uuid="' + escapeHtml(uuid) + '">' +
                    '<span class="screens-list-col-name" title="' + escapeHtml(String(uuid)) + '">' + escapeHtml(shortName) + '</span>' +
                    '<span class="screens-list-col-date">' + escapeHtml(dateStr) + '</span>' +
                    '<span class="screens-list-col-actions">' +
                        '<button class="screens-list-btn screens-list-view screens-btn-view" data-uuid="' + escapeHtml(uuid) + '" title="Ver"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>' +
                        '<button class="screens-list-btn screens-list-download screens-btn-download" data-url="' + escapeHtml(imgUrl) + '" data-filename="screenshot_' + escapeHtml(uuid) + '.bmp" title="Baixar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></button>' +
                        '<button class="screens-list-btn screens-list-delete screens-btn-delete" data-uuid="' + escapeHtml(uuid) + '" title="Excluir"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>' +
                    '</span>' +
                '</div>';
            });
            html += '</div>';
        }

        html += paginationBottom;
        el.innerHTML = html;

        if (viewMode === 'grid') {
            var screensTotal = progressTotal;
            var screensLoaded = 0;
            var progressWrap = $('#screens-progress-wrap');
            var progressFill = $('#screens-progress-fill');
            var progressText = $('#screens-progress-text');

            function updateProgress() {
                screensLoaded++;
                if (screensTotal > 0) {
                    var pct = Math.round((screensLoaded / screensTotal) * 100);
                    if (progressFill) progressFill.style.width = pct + '%';
                    if (progressText) progressText.textContent = 'Carregando ' + screensLoaded + ' / ' + screensTotal;
                    if (screensLoaded >= screensTotal && progressWrap) {
                        setTimeout(function() { progressWrap.classList.add('screens-progress-done'); }, 400);
                    }
                }
            }

            $$('.screenshot-item img[data-auth-src]').forEach(function(img) {
                var loader = img.parentElement.querySelector('.screenshot-loader');
                function hideLoader() {
                    img.style.display = '';
                    if (loader) loader.style.display = 'none';
                    updateProgress();
                }
                img.onload = hideLoader;
                img.onerror = hideLoader;
                NovaAPI.loadAuthImageQueued(img.getAttribute('data-auth-src'), img);
            });

        }

        $$('.screenshot-download, .screens-list-download').forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                NovaAPI.downloadAuthFile(this.dataset.url, this.dataset.filename);
            });
        });

        $$('.screenshot-delete, .screens-list-delete').forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                var uuid = this.dataset.uuid;
                if (!confirm('Excluir esta screenshot?')) return;
                NovaAPI.deleteScreencapture(uuid, function(err) {
                    if (!err) {
                        NovaAPI.removeFromImageCache(uuid);
                        state.screenshots = state.screenshots.filter(function(s) {
                            return (s.filename || s.uuid || s) !== uuid;
                        });
                        renderScreens();
                    }
                });
            });
        });

        $$('.screenshot-item').forEach(function(item) {
            item.addEventListener('click', function() {
                var uuid = this.dataset.uuid;
                openImageViewer(uuid);
            });
        });

        $$('.screens-list-view').forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                openImageViewer(this.dataset.uuid);
            });
        });

        $$('.screens-pg-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var p = parseInt(this.getAttribute('data-page'));
                if (!isNaN(p) && p >= 1 && p <= totalPages) {
                    screensPage = p;
                    screensSetPref('nova_screens_page', String(p));
                    renderScreens();
                    var pageEl = document.getElementById('page-screens');
                    if (pageEl) pageEl.scrollTo(0, 0);
                    window.scrollTo(0, 0);
                }
            });
        });

        $$('.screens-view-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var mode = this.getAttribute('data-view');
                screensSetPref('nova_screens_view_mode', mode);
                renderScreens();
            });
        });

        var sortSelect = document.getElementById('screens-sort-select');
        if (sortSelect) {
            sortSelect.addEventListener('change', function() {
                screensSetPref('nova_screens_sort_order', this.value);
                screensPage = 1;
                screensSetPref('nova_screens_page', '1');
                renderScreens();
            });
        }

        bindTakeScreenshot();
        bindScreensFilter();
    }

    function bindScreensFilter() {
        $$('.screens-filter-btn[data-screens-tid]').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var tid = this.getAttribute('data-screens-tid');
                screensFilterTid = tid || null;
                try {
                    if (screensFilterTid) {
                        localStorage.setItem('nova_screens_filter_tid', screensFilterTid);
                    } else {
                        localStorage.removeItem('nova_screens_filter_tid');
                    }
                } catch(e) {}
                screensPage = 1;
                screensSetPref('nova_screens_page', '1');
                renderScreens();
            });
        });
    }

    function bindTakeScreenshot() {
        var btn = $('#take-screenshot-btn');
        if (btn) {
            btn.addEventListener('click', function() {
                btn.disabled = true;
                btn.innerHTML = '<div class="loader-spinner" style="width:16px;height:16px;border-width:2px;display:inline-block;vertical-align:middle"></div> Capturando...';
                NovaAPI.takeScreencapture(function(err, data) {
                    if (!err && data) {
                        state.screenshots.unshift(data);
                    }
                    renderScreens();
                });
            });
        }
    }

    function openImageViewer(uuid) {
        var viewer = $('#image-viewer');
        var img = $('#viewer-image');
        var dl = $('#viewer-download');
        var url = NovaAPI.getScreencaptureUrl(uuid);
        var filename = 'screenshot_' + uuid + '.png';

        NovaAPI.loadAuthImage(url, img);
        dl.href = '#';
        dl.download = filename;
        dl.onclick = function(e) {
            e.preventDefault();
            NovaAPI.downloadAuthFile(url, filename);
        };
        show(viewer);
    }

    function closeImageViewer() {
        hide($('#image-viewer'));
        $('#viewer-image').src = '';
    }

    var FM_DRIVES = [
        { name: 'Hdd1:', label: 'Hard Drive' },
        { name: 'Usb0:', label: 'USB 0' },
        { name: 'Usb1:', label: 'USB 1' },
        { name: 'Usb2:', label: 'USB 2' },
        { name: 'Flash:', label: 'Flash' },
        { name: 'Game:', label: 'Game (Aurora)' }
    ];
    var FM_ATTR_DIR = 16;

    var folderSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>';
    var fileSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>';
    var downloadSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
    var deleteSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';
    var uploadSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>';
    var newFolderSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>';
    var refreshSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>';
    var driveSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="10" rx="2"/><circle cx="17" cy="12" r="1.5"/></svg>';
    var renameSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>';
    var gearSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';
    var copySvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';

    function fmFormatSize(bytes) {
        if (!bytes || bytes <= 0) return '';
        var sizes = ['B', 'KB', 'MB', 'GB'];
        var i = Math.floor(Math.log(bytes) / Math.log(1024));
        if (i >= sizes.length) i = sizes.length - 1;
        return (bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1) + ' ' + sizes[i];
    }

    function fmFormatSpeed(bytesPerSec) {
        if (!bytesPerSec || bytesPerSec <= 0) return '';
        var sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
        var i = Math.floor(Math.log(bytesPerSec) / Math.log(1024));
        if (i >= sizes.length) i = sizes.length - 1;
        return (bytesPerSec / Math.pow(1024, i)).toFixed(1) + ' ' + sizes[i];
    }

    function fmIsDir(item) {
        if (item.type === 'directory') return true;
        return (item.attributes & FM_ATTR_DIR) !== 0;
    }

    function fmIsBridgeMode() {
        return state.ftpBridgeMode || state.xbdmBridgeMode;
    }

    function fmBuildFullPath(name) {
        var base = state.filesPath;
        if (fmIsBridgeMode()) {
            if (base && base.charAt(base.length - 1) !== '/') base += '/';
        } else {
            if (base && base.charAt(base.length - 1) !== '\\') base += '\\';
        }
        return base + name;
    }

    function fmSep() {
        return fmIsBridgeMode() ? '/' : '\\';
    }

    function fmNavigateTo(path) {
        state.filesPath = path;
        state.filesList = [];
        state.filesError = null;
        state.filesLoading = true;
        renderFiles();

        var listFn;
        if (state.xbdmBridgeMode) {
            listFn = NovaAPI.xbdmList.bind(NovaAPI);
        } else if (state.ftpBridgeMode) {
            listFn = NovaAPI.ftpList.bind(NovaAPI);
        } else {
            listFn = NovaAPI.getFileList.bind(NovaAPI);
        }

        listFn(path, function(err, data) {
            state.filesLoading = false;
            if (err) {
                state.filesError = 'Could not load directory';
                state.filesList = [];
            } else {
                state.filesError = null;
                var items = [];
                if (Array.isArray(data)) {
                    items = data;
                } else if (data && typeof data === 'object' && data.name != null) {
                    items = [data];
                } else if (data && data.files) {
                    items = data.files;
                }
                items = items.filter(function(item) {
                    return item && item.name && item.name !== '.' && item.name !== '..';
                });
                items.sort(function(a, b) {
                    var aDir = fmIsDir(a) ? 0 : 1;
                    var bDir = fmIsDir(b) ? 0 : 1;
                    if (aDir !== bDir) return aDir - bDir;
                    return (a.name || '').toLowerCase().localeCompare((b.name || '').toLowerCase());
                });
                state.filesList = items;
            }
            renderFiles();
        });
    }

    function fmGetParentPath(path) {
        if (!path) return '';
        var sep = fmIsBridgeMode() ? '/' : '\\';
        var clean = path.replace(new RegExp(sep.replace('\\', '\\\\') + '+$'), '');
        var idx = clean.lastIndexOf(sep);
        if (idx === -1) return '';
        var parent = clean.substring(0, idx);
        if (!parent || parent === clean) return '';
        if (fmIsBridgeMode()) parent += '/';
        return parent;
    }

    function fmGetBreadcrumbs(path) {
        if (!path) return [];
        var sep = fmIsBridgeMode() ? '/' : '\\';
        var parts = path.split(sep).filter(function(p) { return p !== ''; });
        var crumbs = [];
        var cumulative = '';
        for (var i = 0; i < parts.length; i++) {
            if (fmIsBridgeMode()) {
                cumulative += '/' + parts[i];
            } else {
                cumulative += (i === 0 ? '' : sep) + parts[i];
            }
            var crumbPath = fmIsBridgeMode() ? cumulative + '/' : cumulative;
            crumbs.push({ label: parts[i], path: crumbPath });
        }
        return crumbs;
    }

    function fmRestoreAndInit() {
        try {
            var savedMode = localStorage.getItem('nova_fm_mode');
            if (savedMode === 'xbdm') {
                state.xbdmBridgeMode = true;
                state.ftpBridgeMode = false;
            } else if (savedMode === 'ftp') {
                state.ftpBridgeMode = true;
                state.xbdmBridgeMode = false;
            } else {
                var legacyMode = localStorage.getItem('nova_ftp_bridge_mode');
                if (legacyMode === 'true') {
                    state.ftpBridgeMode = true;
                }
            }
        } catch(e) {}
        renderFiles();
        fmInitBridge();
        xbdmInitBridge();
    }

    function fmInitBridge() {
        NovaAPI.autoDiscoverFtpBridge(function(err, url, data) {
            var changed = false;
            var userConfiguring = state.currentPage === 'files' && (state.ftpWizardStep > 0 || state.filesPath);
            if (!err && url) {
                if (!state.ftpBridgeConnected) changed = true;
                state.ftpBridgeConnected = true;
                state.ftpBridgeUrl = url;
                state.ftpBridgeInfo = data;
                if (!userConfiguring) {
                    if (!state.xbdmBridgeMode && !state.ftpBridgeMode) {
                        state.ftpBridgeMode = true;
                        try { localStorage.setItem('nova_fm_mode', 'ftp'); } catch(e) {}
                        changed = true;
                    }
                    state.ftpWizardStep = 0;
                }
            } else {
                if (state.ftpBridgeConnected) changed = true;
                state.ftpBridgeConnected = false;
                state.ftpBridgeUrl = '';
                state.ftpBridgeInfo = null;
                if (!userConfiguring && state.ftpBridgeMode) {
                    state.ftpBridgeMode = false;
                    try { localStorage.removeItem('nova_fm_mode'); } catch(e) {}
                    changed = true;
                }
            }
            if (changed && !userConfiguring) renderFiles();
        });
    }

    function xbdmInitBridge() {
        NovaAPI.autoDiscoverXbdmBridge(function(err, url, data) {
            var changed = false;
            var userConfiguring = state.currentPage === 'files' && (state.xbdmWizardStep > 0 || state.filesPath);
            if (!err && url) {
                if (!state.xbdmBridgeConnected) changed = true;
                state.xbdmBridgeConnected = true;
                state.xbdmBridgeUrl = url;
                state.xbdmBridgeInfo = data;
                if (!userConfiguring) {
                    state.xbdmWizardStep = 0;
                }
            } else {
                if (state.xbdmBridgeConnected) changed = true;
                state.xbdmBridgeConnected = false;
                state.xbdmBridgeUrl = '';
                state.xbdmBridgeInfo = null;
                if (!userConfiguring && state.xbdmBridgeMode) {
                    state.xbdmBridgeMode = false;
                    try { localStorage.removeItem('nova_fm_mode'); } catch(e) {}
                    changed = true;
                }
            }
            if (changed && !userConfiguring && state.currentPage === 'files') renderFiles();
            if (changed && state.currentPage === 'home') renderHome();
        });
    }

    function fmShowUploadProgress(fileName, percentage, speed) {
        var existing = $('#fm-upload-overlay');
        if (!existing) {
            var overlay = document.createElement('div');
            overlay.id = 'fm-upload-overlay';
            overlay.className = 'fm-upload-overlay';
            overlay.innerHTML = '<div class="fm-upload-modal">' +
                '<div class="fm-upload-title">Uploading...</div>' +
                '<div class="fm-upload-filename" id="fm-upload-filename"></div>' +
                '<div class="fm-progress-bar"><div class="fm-progress-fill" id="fm-upload-fill"></div></div>' +
                '<div class="fm-progress-text" id="fm-upload-pct">0%</div>' +
                '<div class="fm-progress-speed" id="fm-upload-speed"></div>' +
            '</div>';
            document.body.appendChild(overlay);
        }
        var nameEl = $('#fm-upload-filename');
        var fillEl = $('#fm-upload-fill');
        var pctEl = $('#fm-upload-pct');
        var speedEl = $('#fm-upload-speed');
        if (nameEl) nameEl.textContent = fileName;
        if (fillEl) fillEl.style.width = percentage + '%';
        if (pctEl) pctEl.textContent = percentage + '%';
        if (speedEl) speedEl.textContent = speed ? fmFormatSpeed(speed) : '';
    }

    function fmHideUploadProgress() {
        var el = $('#fm-upload-overlay');
        if (el) el.remove();
    }

    function fmShowDialog(title, placeholder, defaultVal, onConfirm) {
        var overlay = document.createElement('div');
        overlay.className = 'fm-dialog-overlay';
        overlay.innerHTML = '<div class="fm-dialog">' +
            '<div class="fm-dialog-title">' + escapeHtml(title) + '</div>' +
            '<input type="text" class="fm-dialog-input" id="fm-dialog-val" placeholder="' + escapeHtml(placeholder) + '" value="' + escapeHtml(defaultVal || '') + '">' +
            '<div class="fm-dialog-actions">' +
                '<button class="btn" id="fm-dialog-cancel" style="background:var(--bg-secondary);color:var(--text-primary);border:1px solid var(--border)">Cancel</button>' +
                '<button class="btn" id="fm-dialog-ok" style="background:var(--accent);color:#fff;border:none">Confirm</button>' +
            '</div>' +
        '</div>';
        document.body.appendChild(overlay);
        var input = $('#fm-dialog-val');
        if (input) { input.focus(); input.select(); }
        $('#fm-dialog-cancel').addEventListener('click', function() { overlay.remove(); });
        $('#fm-dialog-ok').addEventListener('click', function() {
            var val = input.value.trim();
            overlay.remove();
            if (val && onConfirm) onConfirm(val);
        });
        input.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                var val = input.value.trim();
                overlay.remove();
                if (val && onConfirm) onConfirm(val);
            } else if (e.key === 'Escape') {
                overlay.remove();
            }
        });
    }

    function fmConfirmDelete(path, isDir, name) {
        var overlay = document.createElement('div');
        overlay.className = 'fm-dialog-overlay';
        overlay.innerHTML = '<div class="fm-dialog">' +
            '<div class="fm-dialog-title">Delete ' + (isDir ? 'folder' : 'file') + '?</div>' +
            '<div style="font-size:13px;color:var(--text-secondary);margin-bottom:16px;word-break:break-all">Are you sure you want to delete <strong>' + escapeHtml(name) + '</strong>? This cannot be undone.</div>' +
            '<div class="fm-dialog-actions">' +
                '<button class="btn" id="fm-del-cancel" style="background:var(--bg-secondary);color:var(--text-primary);border:1px solid var(--border)">Cancel</button>' +
                '<button class="btn" id="fm-del-ok" style="background:#ef4444;color:#fff;border:none">Delete</button>' +
            '</div>' +
        '</div>';
        document.body.appendChild(overlay);
        $('#fm-del-cancel').addEventListener('click', function() { overlay.remove(); });
        $('#fm-del-ok').addEventListener('click', function() {
            overlay.remove();
            var deleteFn = state.xbdmBridgeMode ? NovaAPI.xbdmDelete.bind(NovaAPI) : NovaAPI.ftpDelete.bind(NovaAPI);
            deleteFn(path, isDir, function(err) {
                if (err) {
                    showNotification('Failed to delete: ' + err.message, 'error');
                } else {
                    showNotification('Deleted successfully', 'success');
                    fmNavigateTo(state.filesPath);
                }
            });
        });
    }

    function fmUploadFiles() {
        var input = document.createElement('input');
        input.type = 'file';
        input.multiple = true;
        input.style.display = 'none';
        input.addEventListener('change', function() {
            var files = input.files;
            if (!files || files.length === 0) return;
            var names = [];
            for (var i = 0; i < files.length; i++) names.push(files[i].name);
            var uploadStart = Date.now();
            fmShowUploadProgress(names.join(', '), 0, 0);
            var uploadFn = state.xbdmBridgeMode ? NovaAPI.xbdmUpload.bind(NovaAPI) : NovaAPI.ftpUpload.bind(NovaAPI);
            uploadFn(state.filesPath, files, function(progress) {
                var elapsed = (Date.now() - uploadStart) / 1000;
                var speed = elapsed > 0 ? Math.round(progress.loaded / elapsed) : 0;
                fmShowUploadProgress(names.join(', '), progress.percentage || 0, speed);
            }, function(err, data) {
                fmHideUploadProgress();
                if (err) {
                    showNotification('Upload failed: ' + err.message, 'error');
                } else {
                    showNotification(files.length + ' file(s) uploaded', 'success');
                    if (data && data.transferId) {
                        fmPollTransfer(data.transferId);
                    } else {
                        fmNavigateTo(state.filesPath);
                    }
                }
            });
        });
        document.body.appendChild(input);
        input.click();
        setTimeout(function() { input.remove(); }, 60000);
    }

    function fmPollTransfer(transferId) {
        var progressFn = state.xbdmBridgeMode ? NovaAPI.xbdmTransferProgress.bind(NovaAPI) : NovaAPI.ftpTransferProgress.bind(NovaAPI);
        var poll = setInterval(function() {
            progressFn(transferId, function(err, data) {
                if (err || !data) {
                    clearInterval(poll);
                    fmNavigateTo(state.filesPath);
                    return;
                }
                if (data.status === 'completed') {
                    clearInterval(poll);
                    fmNavigateTo(state.filesPath);
                } else if (data.status === 'error') {
                    clearInterval(poll);
                    showNotification('Transfer failed: ' + (data.error || 'Unknown'), 'error');
                    fmNavigateTo(state.filesPath);
                }
            });
        }, 1500);
    }

    function isGameRunning() {
        if (!state.title) return false;
        return !isDashboard(state.title);
    }

    function renderFiles() {
        var el = $('#page-files');
        if (!el) return;

        if (!state.filesPath) {
            renderFilesDriveSelect(el);
            return;
        }

        var crumbs = fmGetBreadcrumbs(state.filesPath);
        var parentPath = fmGetParentPath(state.filesPath);
        var isBridge = fmIsBridgeMode();

        var backBtnHtml = '<button class="fm-back-btn" id="fm-back-btn" title="Go back">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>' +
        '</button>';

        var breadcrumbHtml = '<div class="fm-nav-bar">' + backBtnHtml +
            '<div class="fm-breadcrumb">' +
            '<button class="fm-breadcrumb-item" data-fm-path="">Drives</button>';
        for (var i = 0; i < crumbs.length; i++) {
            breadcrumbHtml += '<span class="fm-breadcrumb-sep">/</span>';
            var cls = i === crumbs.length - 1 ? 'fm-breadcrumb-item current' : 'fm-breadcrumb-item';
            breadcrumbHtml += '<button class="' + cls + '" data-fm-path="' + escapeHtml(crumbs[i].path) + '">' + escapeHtml(crumbs[i].label) + '</button>';
        }
        breadcrumbHtml += '</div></div>';

        var toolbarHtml = '<div class="fm-toolbar">' +
            '<button class="btn" id="fm-refresh-btn" style="background:var(--bg-card);border:1px solid var(--border);color:var(--text-primary)">' + refreshSvg + ' Refresh</button>';

        if (isBridge) {
            toolbarHtml += '<button class="btn" id="fm-upload-btn" style="background:var(--accent);color:#fff;border:none">' + uploadSvg + ' Upload</button>';
            toolbarHtml += '<button class="btn" id="fm-mkdir-btn" style="background:var(--bg-card);border:1px solid var(--border);color:var(--text-primary)">' + newFolderSvg + ' New Folder</button>';
        }

        toolbarHtml += '<div class="fm-toolbar-spacer"></div>';

        var fmStatusLabel, fmDotClass;
        if (state.xbdmBridgeMode) {
            fmDotClass = state.xbdmBridgeConnected ? 'fm-bridge-dot connected xbdm' : 'fm-bridge-dot';
            fmStatusLabel = 'XBDM';
        } else if (state.ftpBridgeMode) {
            fmDotClass = state.ftpBridgeConnected ? 'fm-bridge-dot connected' : 'fm-bridge-dot';
            fmStatusLabel = 'FTP Bridge';
        } else {
            fmDotClass = 'fm-bridge-dot';
            fmStatusLabel = 'Aurora (Read-only)';
        }
        toolbarHtml += '<div class="fm-bridge-status" id="fm-bridge-status" style="cursor:pointer" title="Click to configure bridge">' +
            '<span class="' + fmDotClass + '"></span>' + fmStatusLabel +
        '</div>';

        toolbarHtml += '</div>';

        var headerHtml = '<div class="page-header"><div><div class="page-title">File Manager</div></div></div>';

        var gameWarningHtml = '';
        if (isGameRunning() && !state.xbdmBridgeMode) {
            var runningName = '';
            if (state.title) {
                var gm = findGameByTitleId(getTitleIdFromState());
                runningName = gm ? getGameName(gm) : (state.title.Name || state.title.name || 'um jogo');
            }
            gameWarningHtml = '<div class="fm-game-warning">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>' +
                '<div><strong>Jogo em execução:</strong> ' + escapeHtml(runningName) + '<br>' +
                '<span style="font-size:12px;opacity:0.85">As funções FTP não funcionam enquanto um jogo está rodando. Use o modo <strong>XBDM</strong> ou volte ao dashboard do Aurora.</span></div>' +
            '</div>';
        }

        var contentHtml = '';

        if (state.filesLoading) {
            contentHtml = '<div class="fm-loading"><div class="spinner"></div></div>';
        } else if (state.filesError) {
            contentHtml = '<div class="fm-error">' + escapeHtml(state.filesError) + '</div>';
        } else if (state.filesList.length === 0) {
            contentHtml = '<div class="fm-empty">This folder is empty or not accessible</div>';
        } else {
            contentHtml = '<div class="fm-list">';
            state.filesList.forEach(function(item) {
                var isDir = fmIsDir(item);
                var fullPath = fmBuildFullPath(item.name);
                contentHtml += '<div class="fm-item" data-fm-item-path="' + escapeHtml(fullPath) + '" data-fm-is-dir="' + (isDir ? '1' : '0') + '">' +
                    '<div class="fm-item-icon ' + (isDir ? 'folder' : 'file') + '">' + (isDir ? folderSvg : fileSvg) + '</div>' +
                    '<div class="fm-item-info">' +
                        '<div class="fm-item-name">' + escapeHtml(item.name) + '</div>' +
                        '<div class="fm-item-meta">' + (isDir ? 'Folder' : fmFormatSize(item.size)) + '</div>' +
                    '</div>' +
                    '<div class="fm-item-actions">';

                if (!isDir) {
                    contentHtml += '<button class="fm-action-btn" data-fm-dl="' + escapeHtml(fullPath) + '" data-fm-name="' + escapeHtml(item.name) + '" title="Download">' + downloadSvg + '</button>';
                }
                if (isBridge) {
                    contentHtml += '<button class="fm-action-btn" data-fm-rename="' + escapeHtml(fullPath) + '" data-fm-oldname="' + escapeHtml(item.name) + '" title="Rename">' + renameSvg + '</button>';
                    contentHtml += '<button class="fm-action-btn danger" data-fm-delete="' + escapeHtml(fullPath) + '" data-fm-del-name="' + escapeHtml(item.name) + '" data-fm-del-dir="' + (isDir ? '1' : '0') + '" title="Delete">' + deleteSvg + '</button>';
                }

                contentHtml += '</div></div>';
            });
            contentHtml += '</div>';
        }

        el.innerHTML = headerHtml + gameWarningHtml + breadcrumbHtml + toolbarHtml + contentHtml;

        var backBtn = $('#fm-back-btn');
        if (backBtn) {
            backBtn.addEventListener('click', function() {
                if (parentPath) {
                    fmNavigateTo(parentPath);
                } else {
                    state.filesPath = '';
                    renderFiles();
                }
            });
        }

        $$('.fm-breadcrumb-item').forEach(function(btn) {
            if (btn.classList.contains('current')) return;
            btn.addEventListener('click', function() {
                var p = this.getAttribute('data-fm-path');
                if (p === '') {
                    state.filesPath = '';
                    renderFiles();
                } else {
                    fmNavigateTo(p);
                }
            });
        });

        $$('.fm-item').forEach(function(item) {
            item.addEventListener('click', function(e) {
                if (e.target.closest('.fm-item-actions')) return;
                var isDir = this.getAttribute('data-fm-is-dir') === '1';
                if (isDir) {
                    fmNavigateTo(this.getAttribute('data-fm-item-path'));
                }
            });
        });

        $$('[data-fm-dl]').forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                var fpath = this.getAttribute('data-fm-dl');
                var name = this.getAttribute('data-fm-name');
                if (state.xbdmBridgeMode) {
                    NovaAPI.xbdmDownload(fpath, name);
                } else if (state.ftpBridgeMode) {
                    NovaAPI.ftpDownload(fpath, name);
                } else {
                    NovaAPI.downloadFileFromConsole(fpath, name);
                }
                setTimeout(function() { fmNavigateTo(state.filesPath); }, 1500);
            });
        });

        $$('[data-fm-delete]').forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                var fpath = this.getAttribute('data-fm-delete');
                var name = this.getAttribute('data-fm-del-name');
                var isDir = this.getAttribute('data-fm-del-dir') === '1';
                fmConfirmDelete(fpath, isDir, name);
            });
        });

        $$('[data-fm-rename]').forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                var fpath = this.getAttribute('data-fm-rename');
                var oldName = this.getAttribute('data-fm-oldname');
                fmShowDialog('Rename', 'New name', oldName, function(newName) {
                    if (newName === oldName) return;
                    var sep = fmSep();
                    var parentDir = fpath.substring(0, fpath.lastIndexOf(sep) + 1);
                    var newPath = parentDir + newName;
                    var moveFn = state.xbdmBridgeMode ? NovaAPI.xbdmMove.bind(NovaAPI) : NovaAPI.ftpMove.bind(NovaAPI);
                    moveFn(fpath, newPath, function(err) {
                        if (err) {
                            showNotification('Rename failed: ' + err.message, 'error');
                        } else {
                            showNotification('Renamed successfully', 'success');
                            fmNavigateTo(state.filesPath);
                        }
                    });
                });
            });
        });

        var refreshBtn = $('#fm-refresh-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', function() {
                fmNavigateTo(state.filesPath);
            });
        }

        var uploadBtn = $('#fm-upload-btn');
        if (uploadBtn) {
            uploadBtn.addEventListener('click', function() { fmUploadFiles(); });
        }

        var mkdirBtn = $('#fm-mkdir-btn');
        if (mkdirBtn) {
            mkdirBtn.addEventListener('click', function() {
                fmShowDialog('New Folder', 'Folder name', '', function(name) {
                    var newPath = state.filesPath;
                    var s = fmSep();
                    if (newPath && newPath.charAt(newPath.length - 1) !== s) newPath += s;
                    newPath += name;
                    var mkdirFn = state.xbdmBridgeMode ? NovaAPI.xbdmMkdir.bind(NovaAPI) : NovaAPI.ftpMkdir.bind(NovaAPI);
                    mkdirFn(newPath, function(err) {
                        if (err) {
                            showNotification('Failed to create folder: ' + err.message, 'error');
                        } else {
                            showNotification('Folder created', 'success');
                            fmNavigateTo(state.filesPath);
                        }
                    });
                });
            });
        }

        var bridgeStatusBtn = $('#fm-bridge-status');
        if (bridgeStatusBtn) {
            bridgeStatusBtn.addEventListener('click', function() {
                state.filesPath = '';
                if (state.xbdmBridgeMode) {
                    state.xbdmWizardStep = 0;
                    renderXbdmWizard($('#page-files'));
                } else {
                    state.ftpWizardStep = 0;
                    renderFtpWizard($('#page-files'));
                }
            });
        }
    }

    function renderFilesDriveSelect(el) {
        var statusHtml = '';
        var dsLabel, dsDotClass;
        if (state.xbdmBridgeMode) {
            dsDotClass = state.xbdmBridgeConnected ? 'fm-bridge-dot connected xbdm' : 'fm-bridge-dot';
            dsLabel = 'XBDM Connected';
        } else if (state.ftpBridgeConnected) {
            dsDotClass = 'fm-bridge-dot connected';
            dsLabel = 'FTP Bridge Connected';
        } else {
            dsDotClass = 'fm-bridge-dot';
            dsLabel = 'Aurora Mode (Read-only)';
        }
        statusHtml = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:8px">' +
            '<div class="fm-bridge-status" id="fm-bridge-status-drive" style="cursor:pointer" title="Bridge settings">' +
                '<span class="' + dsDotClass + '"></span>' + dsLabel +
            '</div>' +
            '<div class="fm-mode-toggle">';
        var noMode = !state.ftpBridgeMode && !state.xbdmBridgeMode;
        statusHtml += '<button class="fm-mode-btn' + (noMode ? ' active' : '') + '" id="fm-mode-aurora">Aurora</button>';
        if (state.ftpBridgeConnected) {
            statusHtml += '<button class="fm-mode-btn' + (state.ftpBridgeMode ? ' active' : '') + '" id="fm-mode-ftp">FTP Bridge</button>';
        }
        if (state.xbdmBridgeConnected) {
            statusHtml += '<button class="fm-mode-btn' + (state.xbdmBridgeMode ? ' active' : '') + '" id="fm-mode-xbdm">XBDM</button>';
        }
        statusHtml += '</div></div>';

        if (!state.ftpBridgeConnected && !state.xbdmBridgeConnected) {
            var wizardPromptHtml = '<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:16px;text-align:center">' +
                '<div style="font-size:14px;color:var(--text-secondary);margin-bottom:10px">Want to upload, delete, and manage files on your Xbox?</div>' +
                '<div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">' +
                    '<button class="btn" id="fm-setup-bridge" style="background:var(--accent);color:#fff;border:none;padding:8px 20px">Set Up FTP Bridge</button>' +
                    '<button class="btn" id="fm-setup-xbdm" style="background:var(--bg-secondary);color:var(--text-primary);border:1px solid var(--border);padding:8px 20px">Set Up XBDM Bridge</button>' +
                '</div>' +
            '</div>';
            statusHtml += wizardPromptHtml;
        }

        var driveGameWarning = '';
        if (isGameRunning() && !state.xbdmBridgeMode) {
            var gn = '';
            if (state.title) {
                var gmm = findGameByTitleId(getTitleIdFromState());
                gn = gmm ? getGameName(gmm) : (state.title.Name || state.title.name || 'um jogo');
            }
            driveGameWarning = '<div class="fm-game-warning">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>' +
                '<div><strong>Jogo em execução:</strong> ' + escapeHtml(gn) + '<br>' +
                '<span style="font-size:12px;opacity:0.85">As funções FTP não funcionam enquanto um jogo está rodando. Use o modo <strong>XBDM</strong> ou volte ao dashboard do Aurora.</span></div>' +
            '</div>';
        }

        var html = '<div class="page-header"><div><div class="page-title">File Manager</div><div class="page-subtitle">Select a drive</div></div></div>' +
            driveGameWarning + statusHtml +
            '<div class="fm-drives">';

        FM_DRIVES.forEach(function(drive) {
            html += '<div class="fm-drive" data-fm-drive="' + escapeHtml(drive.name) + '">' +
                '<div class="fm-drive-icon">' + driveSvg + '</div>' +
                '<div class="fm-drive-label">' + escapeHtml(drive.label) + '<div style="font-size:11px;color:var(--text-muted);margin-top:2px">' + escapeHtml(drive.name) + '</div></div>' +
            '</div>';
        });

        html += '</div>';
        el.innerHTML = html;

        $$('.fm-drive').forEach(function(driveEl) {
            driveEl.addEventListener('click', function() {
                var driveName = this.getAttribute('data-fm-drive');
                if (fmIsBridgeMode()) {
                    var bridgeDrive = driveName.replace(/:$/, '');
                    fmNavigateTo('/' + bridgeDrive + '/');
                } else {
                    fmNavigateTo(driveName + '\\');
                }
            });
        });

        var setupBtn = $('#fm-setup-bridge');
        if (setupBtn) {
            setupBtn.addEventListener('click', function() {
                renderFtpWizard(el);
            });
        }

        var setupXbdmBtn = $('#fm-setup-xbdm');
        if (setupXbdmBtn) {
            setupXbdmBtn.addEventListener('click', function() {
                renderXbdmWizard(el);
            });
        }

        var bridgeStatusDrive = $('#fm-bridge-status-drive');
        if (bridgeStatusDrive) {
            bridgeStatusDrive.addEventListener('click', function() {
                if (state.xbdmBridgeMode) {
                    renderXbdmWizard(el);
                } else {
                    renderFtpWizard(el);
                }
            });
        }

        var modeAurora = $('#fm-mode-aurora');
        var modeFtp = $('#fm-mode-ftp');
        var modeXbdm = $('#fm-mode-xbdm');
        if (modeAurora) {
            modeAurora.addEventListener('click', function() {
                state.ftpBridgeMode = false;
                state.xbdmBridgeMode = false;
                try { localStorage.removeItem('nova_fm_mode'); } catch(e) {}
                state.filesPath = '';
                renderFiles();
            });
        }
        if (modeFtp) {
            modeFtp.addEventListener('click', function() {
                state.ftpBridgeMode = true;
                state.xbdmBridgeMode = false;
                try { localStorage.setItem('nova_fm_mode', 'ftp'); } catch(e) {}
                state.filesPath = '';
                renderFiles();
            });
        }
        if (modeXbdm) {
            modeXbdm.addEventListener('click', function() {
                state.xbdmBridgeMode = true;
                state.ftpBridgeMode = false;
                try { localStorage.setItem('nova_fm_mode', 'xbdm'); } catch(e) {}
                state.filesPath = '';
                renderFiles();
            });
        }
    }

    function renderFtpWizard(el) {
        var step = state.ftpWizardStep || 0;
        var totalSteps = 4;

        var stepsHtml = '<div class="ftp-wizard-steps">';
        for (var s = 0; s < totalSteps; s++) {
            var stepClass = 'ftp-wizard-step';
            if (s < step) stepClass += ' done';
            else if (s === step) stepClass += ' active';
            stepsHtml += '<div class="' + stepClass + '"></div>';
        }
        stepsHtml += '</div>';

        var bodyHtml = '';

        if (step === 0) {
            bodyHtml = '<div class="ftp-wizard-card">' +
                stepsHtml +
                '<div class="ftp-wizard-title">FTP Bridge Setup</div>' +
                '<div class="ftp-wizard-desc">The FTP Bridge is a small app that runs on your PC or phone. It connects your browser to your Xbox 360\'s FTP server, allowing you to upload, download, delete, and manage files directly from this WebUI.<br><br>Since modern browsers no longer support FTP, this bridge acts as the middleman.</div>' +
                '<div class="ftp-wizard-options">' +
                    '<div class="ftp-wizard-option" id="wiz-opt-download">' +
                        '<div class="ftp-wizard-option-icon">' + downloadSvg + '</div>' +
                        '<div class="ftp-wizard-option-text">' +
                            '<div class="ftp-wizard-option-title">Download Pre-configured Bridge</div>' +
                            '<div class="ftp-wizard-option-desc">Get a ready-to-run ZIP file with everything you need</div>' +
                        '</div>' +
                    '</div>' +
                    '<div class="ftp-wizard-option" id="wiz-opt-manual">' +
                        '<div class="ftp-wizard-option-icon">' + gearSvg + '</div>' +
                        '<div class="ftp-wizard-option-text">' +
                            '<div class="ftp-wizard-option-title">Manual Setup</div>' +
                            '<div class="ftp-wizard-option-desc">Step-by-step instructions to set up manually</div>' +
                        '</div>' +
                    '</div>' +
                    '<div class="ftp-wizard-option" id="wiz-opt-connect">' +
                        '<div class="ftp-wizard-option-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg></div>' +
                        '<div class="ftp-wizard-option-text">' +
                            '<div class="ftp-wizard-option-title">Already Running? Connect Now</div>' +
                            '<div class="ftp-wizard-option-desc">Enter the bridge URL if it\'s already set up</div>' +
                        '</div>' +
                    '</div>' +
                '</div>' +
                '<div class="ftp-wizard-nav"><button class="btn" id="wiz-back-home" style="background:var(--bg-secondary);color:var(--text-primary);border:1px solid var(--border)">Back to Files</button></div>' +
            '</div>';
        } else if (step === 1) {
            var fileSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;display:inline;vertical-align:middle;margin-right:6px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
            bodyHtml = '<div class="ftp-wizard-card">' +
                stepsHtml +
                '<div class="ftp-wizard-title">Instalação</div>' +
                '<div class="ftp-wizard-desc">Baixe os arquivos do FTP Bridge e siga as instruções para o seu sistema:</div>' +
                '<div class="ftp-wizard-label">Baixar Arquivos</div>' +
                '<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:14px">' +
                    '<button class="btn wiz-dl-btn" id="wiz-dl-bridge" style="background:var(--accent);color:#fff;border:none;padding:10px 16px;width:100%;display:flex;align-items:center;gap:8px;border-radius:8px">' + fileSvg + '<span style="flex:1;text-align:left"><strong>bridge.js</strong> <span style="font-size:11px;opacity:0.8">— servidor FTP Bridge</span></span></button>' +
                    '<button class="btn wiz-dl-btn" id="wiz-dl-config" style="background:var(--accent);color:#fff;border:none;padding:10px 16px;width:100%;display:flex;align-items:center;gap:8px;border-radius:8px">' + fileSvg + '<span style="flex:1;text-align:left"><strong>bridge-config.json</strong> <span style="font-size:11px;opacity:0.8">— configuração FTP</span></span></button>' +
                    '<button class="btn wiz-dl-btn" id="wiz-dl-package" style="background:var(--bg-secondary);color:var(--text-primary);border:1px solid var(--border);padding:10px 16px;width:100%;display:flex;align-items:center;gap:8px;border-radius:8px">' + fileSvg + '<span style="flex:1;text-align:left"><strong>package.json</strong> <span style="font-size:11px;opacity:0.8">— dependências do projeto</span></span></button>' +
                '</div>' +
                '<div style="background:rgba(139,92,246,0.1);border:1px solid rgba(139,92,246,0.3);border-radius:8px;padding:12px;margin-bottom:16px">' +
                    '<div style="font-size:13px;color:var(--accent-light);font-weight:600;margin-bottom:6px">⚠ Importante</div>' +
                    '<div style="font-size:12px;color:var(--text-secondary);line-height:1.5">Coloque os 3 arquivos em uma <strong>única pasta</strong> (ex: <code>godsend-ftp-bridge</code>) antes de executar os comandos abaixo. O bridge vai pedir o IP do Xbox interativamente ao iniciar.</div>' +
                '</div>' +
                '<div style="border-top:1px solid var(--border);margin:16px 0;padding-top:16px">' +
                '<div class="ftp-wizard-label">Windows (CMD / PowerShell)</div>' +
                '<div class="ftp-wizard-cmd" id="cmd-win">cd godsend-ftp-bridge\nnpm install\nnode bridge.js</div>' +
                '<div class="ftp-wizard-label">Linux / macOS (Terminal)</div>' +
                '<div class="ftp-wizard-cmd" id="cmd-linux">cd godsend-ftp-bridge\nnpm install\nnode bridge.js</div>' +
                '<div class="ftp-wizard-label">Android (Termux)</div>' +
                '<div style="font-size:12px;color:var(--text-secondary);margin-bottom:8px;line-height:1.5">' +
                    'Você precisa do <strong>Termux</strong> para rodar o bridge no celular. Baixe pelo F-Droid:' +
                '</div>' +
                '<a href="https://f-droid.org/F-Droid.apk" target="_blank" style="display:flex;align-items:center;justify-content:center;gap:8px;background:#1a73e8;color:#fff;border:none;padding:10px 16px;width:100%;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600;margin-bottom:10px"><span style="display:inline-flex;width:16px;height:16px">' + downloadSvg + '</span> Baixar F-Droid (para instalar Termux)</a>' +
                '<div style="font-size:12px;color:var(--text-secondary);margin-bottom:8px;line-height:1.6">' +
                    '<strong>Passo a passo:</strong><br>' +
                    'O Termux tem seu próprio armazenamento interno (<code>~</code>). Para acessar as pastas do celular (como Downloads), é preciso liberar acesso com <code>termux-setup-storage</code>, que cria atalhos em <code>~/storage/</code>.<br><br>' +
                    '1. Baixe os 3 arquivos acima no celular (vão para a pasta Downloads)<br>' +
                    '2. Abra o Termux e execute os comandos abaixo para liberar acesso e copiar os arquivos:' +
                '</div>' +
                '<div class="ftp-wizard-cmd" id="cmd-termux-setup">termux-setup-storage\nmkdir -p godsend-ftp-bridge\ncp ~/storage/downloads/bridge.js godsend-ftp-bridge/\ncp ~/storage/downloads/bridge-config.json godsend-ftp-bridge/\ncp ~/storage/downloads/package.json godsend-ftp-bridge/</div>' +
                '<div style="font-size:12px;color:var(--text-secondary);margin-bottom:8px;margin-top:10px;line-height:1.5">' +
                    '3. Depois instale as dependências e inicie o bridge:' +
                '</div>' +
                '<div class="ftp-wizard-cmd" id="cmd-termux">pkg install nodejs\ncd godsend-ftp-bridge\nnpm install\nnode bridge.js</div>' +
                '</div>' +
                '<div class="ftp-wizard-nav">' +
                    '<button class="btn" id="wiz-prev" style="background:var(--bg-secondary);color:var(--text-primary);border:1px solid var(--border)">Back</button>' +
                    '<button class="btn" id="wiz-next" style="background:var(--accent);color:#fff;border:none">Next: Connect</button>' +
                '</div>' +
            '</div>';
        } else if (step === 2) {
            var savedUrl = NovaAPI.getFtpBridgeUrl() || 'http://localhost:7860';
            bodyHtml = '<div class="ftp-wizard-card">' +
                stepsHtml +
                '<div class="ftp-wizard-title">Configure & Connect</div>' +
                '<div class="ftp-wizard-desc">Enter the address where your FTP Bridge is running.</div>' +
                '<div class="ftp-wizard-label">Bridge URL</div>' +
                '<input type="text" class="ftp-wizard-input" id="wiz-bridge-url" placeholder="http://localhost:7860" value="' + escapeHtml(savedUrl) + '">' +
                '<div style="font-size:11px;color:var(--text-muted);margin-top:4px;margin-bottom:12px">Usually <code>http://localhost:7860</code> if running on the same PC, or <code>http://192.168.x.x:7860</code> if on another device</div>' +
                '<div style="display:flex;gap:8px;margin-bottom:12px">' +
                    '<button class="btn" id="wiz-auto-detect" style="background:var(--bg-secondary);color:var(--text-primary);border:1px solid var(--border);flex:1"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;display:inline;vertical-align:middle;margin-right:4px"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>Auto-Detect</button>' +
                    '<button class="btn" id="wiz-test-conn" style="background:var(--accent);color:#fff;border:none;flex:1">Test Connection</button>' +
                '</div>' +
                '<div id="wiz-conn-status"></div>' +
                '<div class="ftp-wizard-nav">' +
                    '<button class="btn" id="wiz-prev" style="background:var(--bg-secondary);color:var(--text-primary);border:1px solid var(--border)">Back</button>' +
                    '<button class="btn" id="wiz-next" style="background:var(--accent);color:#fff;border:none" disabled>Next</button>' +
                '</div>' +
            '</div>';
        } else if (step === 3) {
            bodyHtml = '<div class="ftp-wizard-card" style="text-align:center">' +
                stepsHtml +
                '<div style="font-size:48px;margin-bottom:12px">&#10003;</div>' +
                '<div class="ftp-wizard-title">Connected!</div>' +
                '<div class="ftp-wizard-desc">FTP Bridge is connected and ready to use. You can now upload, download, delete, and manage files on your Xbox 360 directly from this browser.</div>' +
                (state.ftpBridgeInfo ? '<div style="font-size:12px;color:var(--text-muted);margin-bottom:8px">Bridge v' + escapeHtml(state.ftpBridgeInfo.version || '1.0.0') + ' | FTP: ' + escapeHtml(state.ftpBridgeInfo.ftp && state.ftpBridgeInfo.ftp.host || '---') + '</div>' : '') +
                '<div class="ftp-wizard-nav">' +
                    '<button class="btn" id="wiz-disconnect" style="background:var(--bg-secondary);color:var(--text-primary);border:1px solid var(--border)">Disconnect</button>' +
                    '<button class="btn" id="wiz-done" style="background:var(--accent);color:#fff;border:none">Open File Manager</button>' +
                '</div>' +
            '</div>';
        }

        el.innerHTML = '<div class="page-header"><div><div class="page-title">File Manager</div><div class="page-subtitle">FTP Bridge Setup</div></div></div>' +
            '<div class="ftp-wizard">' + bodyHtml + '</div>';

        if (step === 0) {
            var optDl = $('#wiz-opt-download');
            var optManual = $('#wiz-opt-manual');
            var optConnect = $('#wiz-opt-connect');
            var backHome = $('#wiz-back-home');
            if (optDl) optDl.addEventListener('click', function() {
                state.ftpWizardStep = 1;
                renderFtpWizard(el);
            });
            if (optManual) optManual.addEventListener('click', function() {
                state.ftpWizardStep = 1;
                renderFtpWizard(el);
            });
            if (optConnect) optConnect.addEventListener('click', function() {
                state.ftpWizardStep = 2;
                renderFtpWizard(el);
            });
            if (backHome) backHome.addEventListener('click', function() {
                state.ftpWizardStep = 0;
                state.filesPath = '';
                renderFiles();
            });
        } else if (step === 1) {
            $$('.ftp-wizard-cmd').forEach(function(cmdBlock) {
                var copyBtn = document.createElement('button');
                copyBtn.className = 'ftp-wizard-cmd-copy';
                copyBtn.innerHTML = copySvg;
                copyBtn.title = 'Copy';
                copyBtn.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    var text = cmdBlock.innerText || cmdBlock.textContent || '';
                    text = text.replace(/\u2713/g, '').trim();
                    function onCopied() {
                        copyBtn.innerHTML = '&#10003;';
                        setTimeout(function() { copyBtn.innerHTML = copySvg; }, 1500);
                    }
                    if (navigator.clipboard && navigator.clipboard.writeText) {
                        navigator.clipboard.writeText(text).then(onCopied).catch(function() {
                            fallbackCopy(text);
                            onCopied();
                        });
                    } else {
                        fallbackCopy(text);
                        onCopied();
                    }
                });
                cmdBlock.style.position = 'relative';
                cmdBlock.appendChild(copyBtn);
            });

            function wizDownloadRawFile(serverPath, filename) {
                var xhr = new XMLHttpRequest();
                xhr.open('GET', serverPath, true);
                xhr.responseType = 'blob';
                xhr.onload = function() {
                    if (xhr.status === 200) {
                        var a = document.createElement('a');
                        a.href = URL.createObjectURL(xhr.response);
                        a.download = filename;
                        document.body.appendChild(a);
                        a.click();
                        setTimeout(function() { document.body.removeChild(a); }, 100);
                    }
                };
                xhr.send();
            }

            var dlBridgeBtn = $('#wiz-dl-bridge');
            if (dlBridgeBtn) dlBridgeBtn.addEventListener('click', function() {
                wizDownloadRawFile(NovaAPI.getCmsUrl() + '/api/bridge/ftp/bridge.js', 'bridge.js');
            });

            var dlConfigBtn = $('#wiz-dl-config');
            if (dlConfigBtn) dlConfigBtn.addEventListener('click', function() {
                wizDownloadRawFile(NovaAPI.getCmsUrl() + '/api/bridge/ftp/bridge-config.json', 'bridge-config.json');
            });

            var dlPkgBtn = $('#wiz-dl-package');
            if (dlPkgBtn) dlPkgBtn.addEventListener('click', function() {
                wizDownloadRawFile(NovaAPI.getCmsUrl() + '/api/bridge/ftp/package.json', 'package.json');
            });

            fmWizardNav(el);
        } else if (step === 2) {
            var testBtn = $('#wiz-test-conn');
            var autoBtn = $('#wiz-auto-detect');
            var urlInput = $('#wiz-bridge-url');
            var statusDiv = $('#wiz-conn-status');
            var nextBtn = $('#wiz-next');

            function onBridgeConnected(url, data) {
                NovaAPI.setFtpBridgeUrl(url);
                state.ftpBridgeConnected = true;
                state.ftpBridgeUrl = url;
                state.ftpBridgeInfo = data;
                state.ftpBridgeMode = true;
                try { localStorage.setItem('nova_ftp_bridge_mode', 'true'); } catch(e) {}
                var ftpOk = data.ftp && data.ftp.connected;
                var ftpStatus = ftpOk ? 'FTP Connected to ' + escapeHtml(data.ftp.host) : 'Bridge online, but Xbox FTP not reachable. Check your Xbox IP in the bridge config.';
                var statusClass = ftpOk ? 'success' : 'error';
                statusDiv.innerHTML = '<div class="ftp-wizard-status ' + statusClass + '">' + ftpStatus + '</div>';
                if (nextBtn) nextBtn.disabled = !ftpOk;
            }

            if (testBtn) testBtn.addEventListener('click', function() {
                var url = urlInput.value.trim();
                if (!url) return;
                statusDiv.innerHTML = '<div class="ftp-wizard-status loading">Testing connection...</div>';
                NovaAPI.checkFtpBridge(url, function(err, data) {
                    if (err) {
                        statusDiv.innerHTML = '<div class="ftp-wizard-status error">Failed: ' + escapeHtml(err.message) + '</div>';
                    } else {
                        onBridgeConnected(url, data);
                    }
                });
            });

            if (autoBtn) autoBtn.addEventListener('click', function() {
                statusDiv.innerHTML = '<div class="ftp-wizard-status loading">Searching for bridge...</div>';
                NovaAPI.autoDiscoverFtpBridge(function(err, url, data) {
                    if (err) {
                        statusDiv.innerHTML = '<div class="ftp-wizard-status error">Bridge not found on common addresses. Enter the URL manually.</div>';
                    } else {
                        urlInput.value = url;
                        onBridgeConnected(url, data);
                    }
                });
            });

            fmWizardNav(el);
        } else if (step === 3) {
            var doneBtn = $('#wiz-done');
            var disconnectBtn = $('#wiz-disconnect');
            if (doneBtn) doneBtn.addEventListener('click', function() {
                state.ftpWizardStep = 0;
                state.filesPath = '';
                renderFiles();
            });
            if (disconnectBtn) disconnectBtn.addEventListener('click', function() {
                NovaAPI.setFtpBridgeUrl('');
                state.ftpBridgeConnected = false;
                state.ftpBridgeUrl = '';
                state.ftpBridgeInfo = null;
                state.ftpBridgeMode = false;
                try { localStorage.removeItem('nova_fm_mode'); } catch(e) {}
                state.ftpWizardStep = 0;
                state.filesPath = '';
                renderFiles();
            });
        }
    }

    function fmWizardNav(el) {
        var prevBtn = $('#wiz-prev');
        var nextBtn = $('#wiz-next');
        if (prevBtn) prevBtn.addEventListener('click', function() {
            state.ftpWizardStep = Math.max(0, (state.ftpWizardStep || 0) - 1);
            renderFtpWizard(el);
        });
        if (nextBtn) nextBtn.addEventListener('click', function() {
            if (this.disabled) return;
            state.ftpWizardStep = (state.ftpWizardStep || 0) + 1;
            renderFtpWizard(el);
        });
    }

    function renderXbdmWizard(el) {
        var step = state.xbdmWizardStep || 0;
        var totalSteps = 4;

        var stepsHtml = '<div class="ftp-wizard-steps">';
        for (var s = 0; s < totalSteps; s++) {
            var stepClass = 'ftp-wizard-step';
            if (s < step) stepClass += ' done';
            else if (s === step) stepClass += ' active';
            stepsHtml += '<div class="' + stepClass + '"></div>';
        }
        stepsHtml += '</div>';

        var bodyHtml = '';

        if (step === 0) {
            bodyHtml = '<div class="ftp-wizard-card">' +
                stepsHtml +
                '<div class="ftp-wizard-title">XBDM Bridge Setup</div>' +
                '<div class="ftp-wizard-desc">' +
                    'The <strong>XBDM Bridge</strong> connects your browser to your Xbox 360\'s XBDM debug service (port 730). ' +
                    'Unlike FTP, XBDM works <strong>even while games are running</strong>, making it ideal for file transfers during gameplay.<br><br>' +
                    '<strong>Requirements:</strong><br>' +
                    '&bull; <strong>xbdm.xex</strong> must be loaded via DashLaunch on your console<br>' +
                    '&bull; Node.js installed on your PC or phone (same as FTP Bridge)' +
                '</div>' +
                '<div class="ftp-wizard-options">' +
                    '<div class="ftp-wizard-option" id="xwiz-opt-download">' +
                        '<div class="ftp-wizard-option-icon">' + downloadSvg + '</div>' +
                        '<div class="ftp-wizard-option-text">' +
                            '<div class="ftp-wizard-option-title">Download & Install XBDM Bridge</div>' +
                            '<div class="ftp-wizard-option-desc">Get the bridge files and step-by-step instructions</div>' +
                        '</div>' +
                    '</div>' +
                    '<div class="ftp-wizard-option" id="xwiz-opt-connect">' +
                        '<div class="ftp-wizard-option-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg></div>' +
                        '<div class="ftp-wizard-option-text">' +
                            '<div class="ftp-wizard-option-title">Already Running? Connect Now</div>' +
                            '<div class="ftp-wizard-option-desc">Enter the bridge URL if it\'s already set up</div>' +
                        '</div>' +
                    '</div>' +
                '</div>' +
                '<div class="ftp-wizard-nav"><button class="btn" id="xwiz-back-home" style="background:var(--bg-secondary);color:var(--text-primary);border:1px solid var(--border)">Back to Files</button></div>' +
            '</div>';
        } else if (step === 1) {
            var fileSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;display:inline;vertical-align:middle;margin-right:6px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
            bodyHtml = '<div class="ftp-wizard-card">' +
                stepsHtml +
                '<div class="ftp-wizard-title">Download & Install</div>' +
                '<div class="ftp-wizard-desc">Download the XBDM Bridge files and follow the instructions for your platform:</div>' +
                '<div class="ftp-wizard-label">Download Files</div>' +
                '<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:14px">' +
                    '<button class="btn wiz-dl-btn" id="xwiz-dl-bridge" style="background:var(--accent);color:#fff;border:none;padding:10px 16px;width:100%;display:flex;align-items:center;gap:8px;border-radius:8px">' + fileSvg + '<span style="flex:1;text-align:left"><strong>xbdm-bridge.js</strong> <span style="font-size:11px;opacity:0.8">— XBDM Bridge server</span></span></button>' +
                    '<button class="btn wiz-dl-btn" id="xwiz-dl-config" style="background:var(--accent);color:#fff;border:none;padding:10px 16px;width:100%;display:flex;align-items:center;gap:8px;border-radius:8px">' + fileSvg + '<span style="flex:1;text-align:left"><strong>xbdm-bridge-config.json</strong> <span style="font-size:11px;opacity:0.8">— XBDM configuration</span></span></button>' +
                    '<button class="btn wiz-dl-btn" id="xwiz-dl-package" style="background:var(--bg-secondary);color:var(--text-primary);border:1px solid var(--border);padding:10px 16px;width:100%;display:flex;align-items:center;gap:8px;border-radius:8px">' + fileSvg + '<span style="flex:1;text-align:left"><strong>package.json</strong> <span style="font-size:11px;opacity:0.8">— dependencies (express, multer)</span></span></button>' +
                '</div>' +
                '<div style="background:rgba(59,130,246,0.1);border:1px solid rgba(59,130,246,0.3);border-radius:8px;padding:12px;margin-bottom:16px">' +
                    '<div style="font-size:13px;color:#60a5fa;font-weight:600;margin-bottom:6px">Important</div>' +
                    '<div style="font-size:12px;color:var(--text-secondary);line-height:1.5">Place all 3 files in a <strong>single folder</strong> (e.g., <code>godsend-xbdm-bridge</code>) then run the commands below. The bridge will ask for your Xbox IP interactively when it starts.</div>' +
                '</div>' +
                '<div style="border-top:1px solid var(--border);margin:16px 0;padding-top:16px">' +
                '<div class="ftp-wizard-label">Windows / macOS / Linux</div>' +
                '<div class="ftp-wizard-cmd" id="xcmd-run">cd godsend-xbdm-bridge\nnpm install\nnode xbdm-bridge.js</div>' +
                '<div class="ftp-wizard-label">Android (Termux)</div>' +
                '<div style="font-size:12px;color:var(--text-secondary);margin-bottom:8px;line-height:1.5">' +
                    'You need <strong>Termux</strong> to run the bridge on your phone. Download it from F-Droid:' +
                '</div>' +
                '<a href="https://f-droid.org/F-Droid.apk" target="_blank" style="display:flex;align-items:center;justify-content:center;gap:8px;background:#1a73e8;color:#fff;border:none;padding:10px 16px;width:100%;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600;margin-bottom:10px"><span style="display:inline-flex;width:16px;height:16px">' + downloadSvg + '</span> Download F-Droid (to install Termux)</a>' +
                '<div style="font-size:12px;color:var(--text-secondary);margin-bottom:8px;line-height:1.6">' +
                    '<strong>Step by step:</strong><br>' +
                    'Termux has its own internal storage (<code>~</code>). To access your phone folders (like Downloads), you need to grant access with <code>termux-setup-storage</code>, which creates shortcuts under <code>~/storage/</code>.<br><br>' +
                    '1. Download the 3 files above on your phone (they go to the Downloads folder)<br>' +
                    '2. Open Termux and run the commands below to grant access and copy the files:' +
                '</div>' +
                '<div class="ftp-wizard-cmd" id="xcmd-termux-setup">termux-setup-storage\nmkdir -p godsend-xbdm-bridge\ncp ~/storage/downloads/xbdm-bridge.js godsend-xbdm-bridge/\ncp ~/storage/downloads/xbdm-bridge-config.json godsend-xbdm-bridge/\ncp ~/storage/downloads/package.json godsend-xbdm-bridge/</div>' +
                '<div style="font-size:12px;color:var(--text-secondary);margin-bottom:8px;margin-top:10px;line-height:1.5">' +
                    '3. Then install dependencies and start the bridge:' +
                '</div>' +
                '<div class="ftp-wizard-cmd" id="xcmd-termux">pkg install nodejs\ncd godsend-xbdm-bridge\nnpm install\nnode xbdm-bridge.js</div>' +
                '</div>' +
                '<div class="ftp-wizard-nav">' +
                    '<button class="btn" id="xwiz-prev" style="background:var(--bg-secondary);color:var(--text-primary);border:1px solid var(--border)">Back</button>' +
                    '<button class="btn" id="xwiz-next" style="background:var(--accent);color:#fff;border:none">Next: Connect</button>' +
                '</div>' +
            '</div>';
        } else if (step === 2) {
            var savedUrl = NovaAPI.getXbdmBridgeUrl() || 'http://localhost:7861';
            bodyHtml = '<div class="ftp-wizard-card">' +
                stepsHtml +
                '<div class="ftp-wizard-title">Connect to XBDM Bridge</div>' +
                '<div class="ftp-wizard-desc">Enter the address where your XBDM Bridge is running (default port: 7861).</div>' +
                '<div class="ftp-wizard-label">Bridge URL</div>' +
                '<input type="text" class="ftp-wizard-input" id="xwiz-bridge-url" placeholder="http://localhost:7861" value="' + escapeHtml(savedUrl) + '">' +
                '<div style="font-size:11px;color:var(--text-muted);margin-top:4px;margin-bottom:12px">Usually <code>http://localhost:7861</code> on the same PC, or <code>http://192.168.x.x:7861</code> from another device</div>' +
                '<div style="display:flex;gap:8px;margin-bottom:12px">' +
                    '<button class="btn" id="xwiz-auto-detect" style="background:var(--bg-secondary);color:var(--text-primary);border:1px solid var(--border);flex:1"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;display:inline;vertical-align:middle;margin-right:4px"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>Auto-Detect</button>' +
                    '<button class="btn" id="xwiz-test-conn" style="background:var(--accent);color:#fff;border:none;flex:1">Test Connection</button>' +
                '</div>' +
                '<div id="xwiz-conn-status"></div>' +
                '<div class="ftp-wizard-nav">' +
                    '<button class="btn" id="xwiz-prev" style="background:var(--bg-secondary);color:var(--text-primary);border:1px solid var(--border)">Back</button>' +
                    '<button class="btn" id="xwiz-next" style="background:var(--accent);color:#fff;border:none" disabled>Next</button>' +
                '</div>' +
            '</div>';
        } else if (step === 3) {
            bodyHtml = '<div class="ftp-wizard-card" style="text-align:center">' +
                stepsHtml +
                '<div style="font-size:48px;margin-bottom:12px">&#10003;</div>' +
                '<div class="ftp-wizard-title">XBDM Connected!</div>' +
                '<div class="ftp-wizard-desc">XBDM Bridge is connected and ready. You can browse files, upload, download, and manage your console — even while a game is running.</div>' +
                (state.xbdmBridgeInfo ? '<div style="font-size:12px;color:var(--text-muted);margin-bottom:8px">Bridge at ' + escapeHtml(state.xbdmBridgeUrl || '') + '</div>' : '') +
                '<div class="ftp-wizard-nav">' +
                    '<button class="btn" id="xwiz-disconnect" style="background:var(--bg-secondary);color:var(--text-primary);border:1px solid var(--border)">Disconnect</button>' +
                    '<button class="btn" id="xwiz-done" style="background:var(--accent);color:#fff;border:none">Open File Manager</button>' +
                '</div>' +
            '</div>';
        }

        el.innerHTML = '<div class="page-header"><div><div class="page-title">File Manager</div><div class="page-subtitle">XBDM Bridge Setup</div></div></div>' +
            '<div class="ftp-wizard">' + bodyHtml + '</div>';

        if (step === 0) {
            var optDl = $('#xwiz-opt-download');
            var optConnect = $('#xwiz-opt-connect');
            var backHome = $('#xwiz-back-home');
            if (optDl) optDl.addEventListener('click', function() {
                state.xbdmWizardStep = 1;
                renderXbdmWizard(el);
            });
            if (optConnect) optConnect.addEventListener('click', function() {
                state.xbdmWizardStep = 2;
                renderXbdmWizard(el);
            });
            if (backHome) backHome.addEventListener('click', function() {
                state.xbdmWizardStep = 0;
                state.filesPath = '';
                renderFiles();
            });
        } else if (step === 1) {
            function xwizDownloadRawFile(serverPath, filename) {
                var xhr = new XMLHttpRequest();
                xhr.open('GET', serverPath, true);
                xhr.responseType = 'blob';
                xhr.onload = function() {
                    if (xhr.status === 200) {
                        var a = document.createElement('a');
                        a.href = URL.createObjectURL(xhr.response);
                        a.download = filename;
                        document.body.appendChild(a);
                        a.click();
                        setTimeout(function() { a.remove(); }, 100);
                    }
                };
                xhr.send();
            }

            var dlBridgeBtn = $('#xwiz-dl-bridge');
            if (dlBridgeBtn) dlBridgeBtn.addEventListener('click', function() {
                xwizDownloadRawFile(NovaAPI.getCmsUrl() + '/api/bridge/xbdm/xbdm-bridge.js', 'xbdm-bridge.js');
            });

            var dlConfigBtn = $('#xwiz-dl-config');
            if (dlConfigBtn) dlConfigBtn.addEventListener('click', function() {
                xwizDownloadRawFile(NovaAPI.getCmsUrl() + '/api/bridge/xbdm/xbdm-bridge-config.json', 'xbdm-bridge-config.json');
            });

            var dlPackageBtn = $('#xwiz-dl-package');
            if (dlPackageBtn) dlPackageBtn.addEventListener('click', function() {
                xwizDownloadRawFile(NovaAPI.getCmsUrl() + '/api/bridge/xbdm/package.json', 'package.json');
            });

            $$('.ftp-wizard-cmd').forEach(function(cmdBlock) {
                var copyBtn = document.createElement('button');
                copyBtn.className = 'ftp-wizard-cmd-copy';
                copyBtn.innerHTML = copySvg;
                copyBtn.title = 'Copy';
                copyBtn.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    var text = cmdBlock.innerText || cmdBlock.textContent || '';
                    text = text.replace(/\u2713/g, '').trim();
                    function onCopied() {
                        copyBtn.innerHTML = '&#10003;';
                        setTimeout(function() { copyBtn.innerHTML = copySvg; }, 1500);
                    }
                    if (navigator.clipboard && navigator.clipboard.writeText) {
                        navigator.clipboard.writeText(text).then(onCopied).catch(function() {
                            fallbackCopy(text);
                            onCopied();
                        });
                    } else {
                        fallbackCopy(text);
                        onCopied();
                    }
                });
                cmdBlock.style.position = 'relative';
                cmdBlock.appendChild(copyBtn);
            });

            var xwizPrev = $('#xwiz-prev');
            var xwizNext = $('#xwiz-next');
            if (xwizPrev) xwizPrev.addEventListener('click', function() {
                state.xbdmWizardStep = 0;
                renderXbdmWizard(el);
            });
            if (xwizNext) xwizNext.addEventListener('click', function() {
                state.xbdmWizardStep = 2;
                renderXbdmWizard(el);
            });
        } else if (step === 2) {
            var urlInput = $('#xwiz-bridge-url');
            var testBtn = $('#xwiz-test-conn');
            var autoBtn = $('#xwiz-auto-detect');
            var statusDiv = $('#xwiz-conn-status');
            var nextBtn = $('#xwiz-next');
            var prevBtn = $('#xwiz-prev');

            function onXbdmConnected(url, data) {
                NovaAPI.setXbdmBridgeUrl(url);
                state.xbdmBridgeConnected = true;
                state.xbdmBridgeUrl = url;
                state.xbdmBridgeInfo = data;
                if (statusDiv) statusDiv.innerHTML = '<div class="ftp-wizard-status success">Connected to XBDM Bridge!</div>';
                if (nextBtn) nextBtn.disabled = false;
            }

            if (testBtn) testBtn.addEventListener('click', function() {
                var url = urlInput.value.trim();
                if (!url) return;
                if (statusDiv) statusDiv.innerHTML = '<div class="ftp-wizard-status loading">Testing connection...</div>';
                NovaAPI.checkXbdmBridge(url, function(err, data) {
                    if (err) {
                        if (statusDiv) statusDiv.innerHTML = '<div class="ftp-wizard-status error">Failed: ' + escapeHtml(err.message) + '</div>';
                    } else {
                        onXbdmConnected(url, data);
                    }
                });
            });

            if (autoBtn) autoBtn.addEventListener('click', function() {
                if (statusDiv) statusDiv.innerHTML = '<div class="ftp-wizard-status loading">Searching for XBDM bridge...</div>';
                NovaAPI.autoDiscoverXbdmBridge(function(err, url, data) {
                    if (err) {
                        if (statusDiv) statusDiv.innerHTML = '<div class="ftp-wizard-status error">Bridge not found. Enter the URL manually.</div>';
                    } else {
                        if (urlInput) urlInput.value = url;
                        onXbdmConnected(url, data);
                    }
                });
            });

            if (prevBtn) prevBtn.addEventListener('click', function() {
                state.xbdmWizardStep = 1;
                renderXbdmWizard(el);
            });
            if (nextBtn) nextBtn.addEventListener('click', function() {
                if (this.disabled) return;
                state.xbdmWizardStep = 3;
                renderXbdmWizard(el);
            });
        } else if (step === 3) {
            var doneBtn = $('#xwiz-done');
            var disconnectBtn = $('#xwiz-disconnect');
            if (doneBtn) doneBtn.addEventListener('click', function() {
                state.xbdmBridgeMode = true;
                state.ftpBridgeMode = false;
                state.xbdmWizardStep = 0;
                state.filesPath = '';
                try { localStorage.setItem('nova_fm_mode', 'xbdm'); } catch(e) {}
                renderFiles();
            });
            if (disconnectBtn) disconnectBtn.addEventListener('click', function() {
                NovaAPI.setXbdmBridgeUrl('');
                state.xbdmBridgeConnected = false;
                state.xbdmBridgeUrl = '';
                state.xbdmBridgeInfo = null;
                state.xbdmBridgeMode = false;
                try { localStorage.removeItem('nova_fm_mode'); } catch(e) {}
                state.xbdmWizardStep = 0;
                state.filesPath = '';
                renderFiles();
            });
        }
    }

    function renderInfoRow(label, value) {
        return '<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)">' +
            '<span style="color:var(--text-muted);font-size:12px">' + escapeHtml(label) + '</span>' +
            '<span style="font-size:13px;font-family:monospace;text-align:right;max-width:60%;word-break:break-all">' + escapeHtml(String(value)) + '</span>' +
        '</div>';
    }

    var chevronDownSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>';
    var iconLink = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>';
    var iconBandwidth = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>';
    var iconDevice = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>';
    var iconChip = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/></svg>';
    var iconPlugin = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v6m0 0a3 3 0 1 0 0 6m0-6a3 3 0 1 1 0 6m0 0v8"/><path d="M5 12H2m20 0h-3"/></svg>';
    var iconThread = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v4m0 14v4M4.22 4.22l2.83 2.83m9.9 9.9l2.83 2.83M1 12h4m14 0h4M4.22 19.78l2.83-2.83m9.9-9.9l2.83-2.83"/></svg>';
    var iconDashlaunch = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>';
    var iconProfile = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';

    function safeStr(val) {
        if (val == null) return '---';
        if (typeof val === 'object') {
            try { return JSON.stringify(val); } catch(e) { return String(val); }
        }
        return String(val);
    }

    function settingsInfoRow(label, value) {
        return '<div class="settings-info-row"><span class="settings-info-label">' + escapeHtml(String(label)) + '</span><span class="settings-info-value">' + escapeHtml(safeStr(value)) + '</span></div>';
    }

    function settingsCard(id, icon, title, summaryHtml, bodyHtml, startOpen) {
        var openClass = startOpen ? ' open' : '';
        var collapsedClass = startOpen ? '' : ' collapsed';
        return '<div class="settings-card" id="sc-' + id + '">' +
            '<div class="settings-card-header" data-toggle="sc-' + id + '">' +
                '<div class="settings-card-title">' + icon + ' ' + escapeHtml(title) + '</div>' +
                '<div class="settings-card-toggle' + openClass + '">' + chevronDownSvg + '</div>' +
            '</div>' +
            (summaryHtml ? '<div class="settings-card-summary">' + summaryHtml + '</div>' : '') +
            '<div class="settings-card-body' + collapsedClass + '">' + bodyHtml + '</div>' +
        '</div>';
    }

    function formatVersion(v) {
        if (!v) return '---';
        if (typeof v === 'string') return v;
        if (v.number) {
            var n = v.number;
            var ver = (n.major || 0) + '.' + (n.minor || 0) + '.' + (n.build || 0);
            if (n.type != null) ver += ' (type ' + n.type + ')';
            return ver;
        }
        if (v.major != null) return (v.major || 0) + '.' + (v.minor || 0) + '.' + (v.build || 0);
        return String(v);
    }

    function formatBytes2(bytes) {
        if (!bytes || bytes === 0) return '0 B';
        var k = 1024;
        var sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        var i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    function getProfileSlots() {
        try {
            var data = localStorage.getItem('nova_profile_slots');
            if (data) {
                var parsed = JSON.parse(data);
                if (Array.isArray(parsed)) return parsed.filter(function(s) { return s !== null; });
            }
        } catch(e) {}
        return [];
    }

    function saveProfileSlots(slots) {
        try {
            localStorage.setItem('nova_profile_slots', JSON.stringify(slots));
        } catch(e) {}
    }

    function deleteProfileSlot(index) {
        var slots = getProfileSlots();
        if (index >= 0 && index < slots.length) {
            slots.splice(index, 1);
            saveProfileSlots(slots);
        }
        var grid = $('#settings-profiles-grid');
        if (grid) renderProfileSlots(grid, slots, false);
    }

    function updateProfileSlot(profile) {
        if (!profile || !(profile.gamertag || profile.Gamertag)) return;
        var gt = profile.gamertag || profile.Gamertag;
        var slots = getProfileSlots();
        var existingIdx = -1;
        for (var i = 0; i < slots.length; i++) {
            if (slots[i] && (slots[i].gamertag === gt || slots[i].Gamertag === gt)) {
                existingIdx = i;
                break;
            }
        }
        var profileData = {
            gamertag: gt,
            gamerscore: profile.gamerscore || profile.Gamerscore || 0,
            xuid: profile.xuid || profile.XUID || '---',
            signedin: profile.signedin || profile.SignedIn || 0,
            index: profile.index != null ? profile.index : 0,
            lastSeen: Date.now()
        };
        if (existingIdx >= 0) {
            slots[existingIdx] = profileData;
        } else {
            slots.push(profileData);
        }
        saveProfileSlots(slots);
    }

    function renderSettings() {
        var el = $('#page-settings');
        var html = '<div class="page-header"><div class="page-title">Console</div></div>';

        html += '<div id="settings-syslink-row" class="settings-grid"></div>';
        html += '<div id="settings-device-row" class="settings-grid"></div>';
        html += '<div id="settings-plugin-row" class="settings-grid"></div>';
        html += '<div id="settings-dashlaunch-row"></div>';
        html += '<div id="settings-temp-row" style="margin-top:16px"></div>';

        html += '<div class="settings-section-title">Profiles</div>';
        html += '<div class="settings-grid settings-grid-2col" id="settings-profiles-grid"></div>';

        html += '<div class="settings-section-title">Sistema</div>';
        html += '<div class="settings-grid settings-grid-2col">';
        html += '<div id="settings-cms-row"></div>';
        html += '<div id="settings-preferences-row"></div>';
        html += '<div id="settings-app-installer-row"></div>';
        html += '<div id="settings-push-row"></div>';
        html += '<div id="settings-feedback-row"></div>';
        html += '<div id="settings-credits-row"></div>';
        html += '</div>';

        html += '<div class="settings-actions">' +
            '<button class="btn" id="settings-refresh">Refresh All</button>' +
            '<button class="btn danger" id="settings-logout">Logout</button>' +
        '</div>';


        el.innerHTML = html;

        $('#settings-refresh').addEventListener('click', function() { refreshAllData(); });
        $('#settings-logout').addEventListener('click', function() {
            NovaAPI.stopAutoRefresh();
            NovaAPI.logout();
            showLogin(I18n.t('login_logged_out'));
        });

        loadSettingsCms();
        loadSettingsPreferences();
        loadSettingsAppInstaller();
        loadSettingsPush();
        loadSettingsFeedback();
        loadSettingsCredits();
        loadSettingsSystemLink();
        loadSettingsDeviceSmc();
        loadSettingsTemperatures();
        loadSettingsPluginThreads();
        loadSettingsDashLaunch();
        loadSettingsProfiles();
    }

    function loadSettingsFeedback() {
        var row = $('#settings-feedback-row');
        if (!row) return;

        var iconFeedback = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"/></svg>';
        var summary = I18n.t('feedback_desc');
        var body = '<button class="btn" id="feedback-open-btn">' + I18n.t('feedback_send') + '</button>';

        row.innerHTML = settingsCard('feedback', iconFeedback, I18n.t('feedback_title'), summary, body, false);
        bindSettingsToggles(row);

        var openBtn = $('#feedback-open-btn');
        if (openBtn) {
            openBtn.addEventListener('click', function() {
                openFeedbackModal();
            });
        }
    }

    function loadSettingsCredits() {
        var row = $('#settings-credits-row');
        if (!row) return;

        var icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>';
        var body = '<p style="margin:0;line-height:1.5;color:var(--text-secondary)">' + I18n.t('credits_desc') + '</p>';

        row.innerHTML = settingsCard('credits', icon, I18n.t('credits_title'), '', body, false);
        bindSettingsToggles(row);
    }

    function openFeedbackModal() {
        if (!isCmsLoggedIn()) {
            showToast(I18n.t('feedback_login_required'));
            return;
        }
        var existing = $('#feedback-modal-overlay');
        if (existing) existing.remove();

        var overlay = document.createElement('div');
        overlay.id = 'feedback-modal-overlay';
        overlay.className = 'feedback-overlay';
        overlay.innerHTML =
            '<div class="feedback-modal">' +
                '<div class="feedback-modal-header">' +
                    '<h3>' + I18n.t('feedback_title') + '</h3>' +
                    '<button class="feedback-close-btn" id="feedback-close">&times;</button>' +
                '</div>' +
                '<div class="feedback-modal-body">' +
                    '<div class="feedback-field">' +
                        '<label>' + I18n.t('feedback_category') + '</label>' +
                        '<div class="feedback-categories" id="feedback-categories">' +
                            '<button class="feedback-cat-btn active" data-cat="general">' + I18n.t('feedback_category_general') + '</button>' +
                            '<button class="feedback-cat-btn" data-cat="bug">' + I18n.t('feedback_category_bug') + '</button>' +
                            '<button class="feedback-cat-btn" data-cat="suggestion">' + I18n.t('feedback_category_suggestion') + '</button>' +
                        '</div>' +
                    '</div>' +
                    '<div class="feedback-field">' +
                        '<label>' + I18n.t('feedback_field_title') + '</label>' +
                        '<input type="text" id="feedback-title-input" maxlength="255" placeholder="' + I18n.t('feedback_field_title') + '">' +
                    '</div>' +
                    '<div class="feedback-field">' +
                        '<label>' + I18n.t('feedback_field_description') + '</label>' +
                        '<textarea id="feedback-desc-input" rows="5" maxlength="5000" placeholder="' + I18n.t('feedback_field_description') + '"></textarea>' +
                    '</div>' +
                    '<div class="feedback-field">' +
                        '<label>' + I18n.t('feedback_rating') + '</label>' +
                        '<div class="feedback-stars" id="feedback-stars">' +
                            '<span class="feedback-star" data-star="1">&#9733;</span>' +
                            '<span class="feedback-star" data-star="2">&#9733;</span>' +
                            '<span class="feedback-star" data-star="3">&#9733;</span>' +
                            '<span class="feedback-star" data-star="4">&#9733;</span>' +
                            '<span class="feedback-star" data-star="5">&#9733;</span>' +
                        '</div>' +
                    '</div>' +
                '</div>' +
                '<div class="feedback-modal-footer">' +
                    '<button class="btn" id="feedback-submit-btn">' + I18n.t('feedback_send') + '</button>' +
                '</div>' +
            '</div>';

        document.body.appendChild(overlay);

        var selectedCategory = 'general';
        var selectedRating = 0;

        overlay.addEventListener('click', function(e) {
            if (e.target === overlay) closeFeedbackModal();
        });
        $('#feedback-close').addEventListener('click', closeFeedbackModal);

        var catBtns = overlay.querySelectorAll('.feedback-cat-btn');
        catBtns.forEach(function(btn) {
            btn.addEventListener('click', function() {
                catBtns.forEach(function(b) { b.classList.remove('active'); });
                btn.classList.add('active');
                selectedCategory = btn.getAttribute('data-cat');
            });
        });

        var stars = overlay.querySelectorAll('.feedback-star');
        stars.forEach(function(star) {
            star.addEventListener('click', function() {
                selectedRating = parseInt(star.getAttribute('data-star'));
                stars.forEach(function(s) {
                    s.classList.toggle('active', parseInt(s.getAttribute('data-star')) <= selectedRating);
                });
            });
            star.addEventListener('mouseenter', function() {
                var hoverVal = parseInt(star.getAttribute('data-star'));
                stars.forEach(function(s) {
                    s.classList.toggle('hover', parseInt(s.getAttribute('data-star')) <= hoverVal);
                });
            });
            star.addEventListener('mouseleave', function() {
                stars.forEach(function(s) { s.classList.remove('hover'); });
            });
        });

        $('#feedback-submit-btn').addEventListener('click', function() {
            var title = ($('#feedback-title-input') || {}).value || '';
            var desc = ($('#feedback-desc-input') || {}).value || '';
            if (!title.trim() || !desc.trim()) {
                showToast(I18n.t('feedback_error'));
                return;
            }

            var consoleInfo = {};
            if (state.systemInfo) {
                var s = state.systemInfo;
                consoleInfo.consoleType = s.ConsoleType || s.consoletype || '';
                consoleInfo.motherboard = s.Motherboard || s.motherboard || '';
                consoleInfo.kernel = s.Kernel || s.kernel || '';
                if (!consoleInfo.kernel && s.version) {
                    consoleInfo.kernel = (s.version.major || 0) + '.' + (s.version.minor || 0) + '.' + (s.version.build || 0) + '.' + (s.version.qfe || 0);
                }
            }
            if (state.cmsProfile) {
                consoleInfo.gamertag = state.cmsProfile.gamertag || state.cmsProfile.display_name || '';
            }
            if (state.dashVersion) {
                consoleInfo.dashVersion = state.dashVersion;
            }

            var submitBtn = $('#feedback-submit-btn');
            submitBtn.disabled = true;
            submitBtn.textContent = I18n.t('feedback_sending');

            NovaAPI.submitFeedback({
                title: title.trim(),
                description: desc.trim(),
                category: selectedCategory,
                rating: selectedRating || null,
                console_info: consoleInfo
            }, function(err) {
                if (err) {
                    showToast(I18n.t('feedback_error'));
                    submitBtn.disabled = false;
                    submitBtn.textContent = I18n.t('feedback_send');
                } else {
                    showToast(I18n.t('feedback_success'));
                    closeFeedbackModal();
                }
            });
        });
    }

    function closeFeedbackModal() {
        var overlay = $('#feedback-modal-overlay');
        if (overlay) {
            overlay.classList.add('closing');
            setTimeout(function() { overlay.remove(); }, 200);
        }
    }

    function loadSettingsCms() {
        var row = $('#settings-cms-row');
        if (!row) return;

        var body = '<div id="cms-url-status" style="font-size:12px;margin-bottom:10px"></div>' +
            '<button class="btn" id="cms-test-btn" style="white-space:nowrap">Testar Conexão</button>' +
            '<div style="font-size:11px;color:var(--text-muted);margin-top:8px">Teste a conexão com o servidor.</div>';

        var summary = '<span id="cms-status-dot" style="display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px;background:#888"></span><span id="cms-status-text">Verificando...</span>';

        row.innerHTML = settingsCard('cms', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>', 'GodStix', summary, body, true);

        var testBtn = $('#cms-test-btn');
        if (testBtn) {
            testBtn.addEventListener('click', function() {
                updateCmsStatus();
            });
        }

        function updateCmsStatus() {
            var dot = $('#cms-status-dot');
            var text = $('#cms-status-text');
            var statusDiv = $('#cms-url-status');
            if (dot) dot.style.background = '#888';
            if (text) text.textContent = 'Verificando...';
            if (statusDiv) statusDiv.innerHTML = '<span style="color:var(--text-muted)">Testando conexão...</span>';

            NovaAPI.checkOnline(function(online) {
                if (dot) dot.style.background = online ? '#4ade80' : '#ef4444';
                if (text) text.textContent = online ? 'Conectado' : 'Offline';
                if (statusDiv) {
                    statusDiv.innerHTML = online
                        ? '<span style="color:#4ade80">&#10003; Conectado ao servidor</span>'
                        : '<span style="color:#ef4444">&#10007; Não foi possível conectar ao servidor</span>';
                }
            });
        }

        updateCmsStatus();
    }

    function loadSettingsPreferences() {
        var row = $('#settings-preferences-row');
        if (!row) return;

        var timezones = [
            { value: 'America/Sao_Paulo', label: 'Brasília (GMT-3)' },
            { value: 'America/Manaus', label: 'Manaus (GMT-4)' },
            { value: 'America/Rio_Branco', label: 'Rio Branco / Acre (GMT-5)' },
            { value: 'America/Noronha', label: 'Fernando de Noronha (GMT-2)' },
            { value: 'America/New_York', label: 'New York (EST)' },
            { value: 'America/Chicago', label: 'Chicago (CST)' },
            { value: 'America/Denver', label: 'Denver (MST)' },
            { value: 'America/Los_Angeles', label: 'Los Angeles (PST)' },
            { value: 'America/Mexico_City', label: 'Cidade do México' },
            { value: 'America/Argentina/Buenos_Aires', label: 'Buenos Aires (GMT-3)' },
            { value: 'Europe/London', label: 'Londres (GMT)' },
            { value: 'Europe/Paris', label: 'Paris (CET)' },
            { value: 'Europe/Berlin', label: 'Berlim (CET)' },
            { value: 'Europe/Moscow', label: 'Moscou (MSK)' },
            { value: 'Asia/Tokyo', label: 'Tóquio (JST)' },
            { value: 'Australia/Sydney', label: 'Sydney (AEST)' }
        ];

        var currentTz = getUserTimezone();
        var selectHtml = '<select id="settings-timezone-select" class="room-form-select">';
        timezones.forEach(function(tz) {
            selectHtml += '<option value="' + tz.value + '"' + (currentTz === tz.value ? ' selected' : '') + '>' + escapeHtml(tz.label) + '</option>';
        });
        selectHtml += '</select>';

        var body = '<div class="room-form-field">' +
            '<label>Fuso Horário</label>' +
            selectHtml +
            '<div style="font-size:11px;color:var(--text-muted);margin-top:6px">Os horários das salas serão exibidos no fuso horário selecionado.</div>' +
        '</div>';

        var matchedTz = timezones.find(function(t) { return t.value === currentTz; });
        var summary = escapeHtml(matchedTz ? matchedTz.label : currentTz);

        row.innerHTML = settingsCard('prefs', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>', 'Fuso Horário', summary, body, true);

        var tzSelect = $('#settings-timezone-select');
        if (tzSelect) {
            tzSelect.addEventListener('change', function() {
                setUserTimezone(this.value);
                var summaryEl = row.querySelector('.settings-card-summary');
                if (summaryEl) {
                    var found = timezones.find(function(t) { return t.value === tzSelect.value; });
                    summaryEl.textContent = found ? found.label : tzSelect.value;
                }
            });
        }

        bindSettingsToggles(row);
    }

    function loadSettingsAppInstaller() {
        var row = $('#settings-app-installer-row');
        if (!row) return;

        var isPwa = typeof GodStixPWA !== 'undefined' && GodStixPWA.isStandalone();

        var iconDownload = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
        var iconCheck = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>';

        var icon = isPwa ? iconCheck : iconDownload;
        var summary = isPwa ? I18n.t('app_installer_installed') : I18n.t('app_installer_not_installed');
        var body;

        if (isPwa) {
            body = '<div style="display:flex;align-items:center;gap:8px;padding:4px 0">' +
                '<span style="color:var(--accent);font-size:20px">&#10003;</span>' +
                '<span style="font-size:13px;color:var(--text-muted)">' + escapeHtml(I18n.t('app_installer_installed_msg')) + '</span>' +
            '</div>';
        } else {
            body = '<div style="font-size:13px;color:var(--text-muted);margin-bottom:12px">' + escapeHtml(I18n.t('app_installer_desc')) + '</div>' +
                '<a href="https://stix.speedygamesdownloads.com/pwa/" target="_blank" rel="noopener" class="btn" id="settings-install-app-btn" style="display:inline-flex;align-items:center;gap:6px;text-decoration:none">' +
                    iconDownload + ' ' + escapeHtml(I18n.t('app_installer_btn')) +
                '</a>';
        }

        row.innerHTML = settingsCard('app-installer', icon, I18n.t('app_installer_title'), summary, body, false);
        bindSettingsToggles(row);
    }

    function renderPushCard(permission, hasSubscription) {
        var row = $('#settings-push-row');
        if (!row) return;

        var iconBell = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>';
        var iconBellOff = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M13.73 21a2 2 0 0 1-3.46 0"/><path d="M18.63 13A17.89 17.89 0 0 1 18 8"/><path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14"/><path d="M18 8a6 6 0 0 0-9.33-5"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';

        var icon, summary, body;

        if (permission === 'unsupported') {
            icon = iconBellOff;
            summary = I18n.t('push_not_supported');
            body = '<div style="font-size:13px;color:var(--text-muted)">' + escapeHtml(I18n.t('push_not_supported_desc')) + '</div>';
        } else if (permission === 'granted' && hasSubscription) {
            icon = iconBell;
            summary = I18n.t('push_enabled');
            body = '<div style="display:flex;align-items:center;gap:8px;padding:4px 0;margin-bottom:12px">' +
                '<span style="color:var(--accent);font-size:20px">&#10003;</span>' +
                '<span style="font-size:13px;color:var(--text-muted)">' + escapeHtml(I18n.t('push_enabled_desc')) + '</span>' +
            '</div>' +
            '<button class="btn" id="settings-push-disable-btn" style="display:inline-flex;align-items:center;gap:6px;background:var(--bg-secondary)">' +
                iconBellOff + ' ' + escapeHtml(I18n.t('push_disable_btn')) +
            '</button>';
        } else if (permission === 'denied') {
            icon = iconBellOff;
            summary = I18n.t('push_blocked');
            body = '<div style="font-size:13px;color:var(--text-muted)">' + escapeHtml(I18n.t('push_blocked_desc')) + '</div>';
        } else {
            icon = iconBellOff;
            summary = I18n.t('push_disabled');
            body = '<div style="font-size:13px;color:var(--text-muted);margin-bottom:12px">' + escapeHtml(I18n.t('push_disabled_desc')) + '</div>' +
                '<button class="btn" id="settings-push-enable-btn" style="display:inline-flex;align-items:center;gap:6px">' +
                    iconBell + ' ' + escapeHtml(I18n.t('push_enable_btn')) +
                '</button>';
        }

        row.innerHTML = settingsCard('push-notif', icon, I18n.t('push_title'), summary, body, false);
        bindSettingsToggles(row);

        var enableBtn = $('#settings-push-enable-btn');
        if (enableBtn) {
            enableBtn.addEventListener('click', function() {
                var isOnHttp = location.protocol === 'http:';
                if (isOnHttp) {
                    openPushEnablePopup();
                } else {
                    Notification.requestPermission().then(function(perm) {
                        if (perm === 'granted') {
                            completePushRegistration();
                        }
                        loadSettingsPush();
                    });
                }
            });
        }

        var disableBtn = $('#settings-push-disable-btn');
        if (disableBtn) {
            disableBtn.addEventListener('click', function() {
                disableBtn.disabled = true;
                disableBtn.textContent = '...';
                disablePushNotifications(function() {
                    loadSettingsPush();
                });
            });
        }
    }

    function openPushEnablePopup() {
        var cmsUrl = NovaAPI.getCmsUrl();
        var httpsUrl = cmsUrl.replace(/^http:/, 'https:');
        var token = NovaAPI.getCmsAuthToken() || '';
        var url = httpsUrl + '/pwa/push-enable.html';
        var popup = window.open(url, 'godstix_push', 'width=400,height=500,scrollbars=no,resizable=no');

        var initSent = false;
        function trySendInit() {
            if (initSent || !popup) return;
            try {
                popup.postMessage({ type: 'push-enable-init', token: token }, httpsUrl);
                initSent = true;
            } catch(e) {}
        }

        var initInterval = setInterval(function() {
            if (initSent) { clearInterval(initInterval); return; }
            trySendInit();
        }, 300);
        setTimeout(function() { clearInterval(initInterval); }, 10000);

        var expectedPushOrigin = new URL(httpsUrl).origin;
        function onMessage(e) {
            if (!e.data || e.data.type !== 'push-enable-result') return;
            if (e.origin !== expectedPushOrigin) return;
            window.removeEventListener('message', onMessage);
            loadSettingsPush();
        }
        window.addEventListener('message', onMessage);

        var check = setInterval(function() {
            if (popup && popup.closed) {
                clearInterval(check);
                clearInterval(initInterval);
                window.removeEventListener('message', onMessage);
                loadSettingsPush();
            }
        }, 500);
    }

    function loadSettingsPush() {
        var row = $('#settings-push-row');
        if (!row) return;

        var isOnHttp = location.protocol === 'http:';
        var hasNativeSupport = 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;

        if (hasNativeSupport && !isOnHttp) {
            var perm = Notification.permission;
            if (perm === 'granted') {
                navigator.serviceWorker.getRegistration().then(function(reg) {
                    if (!reg) { renderPushCard('default', false); return; }
                    reg.pushManager.getSubscription().then(function(sub) {
                        renderPushCard('granted', !!sub);
                    }).catch(function() { renderPushCard('granted', false); });
                }).catch(function() { renderPushCard('granted', false); });
            } else {
                renderPushCard(perm, false);
            }
            return;
        }

        if (isOnHttp) {
            renderPushCard('default', false);

            var cmsUrl = NovaAPI.getCmsUrl();
            var httpsUrl = cmsUrl.replace(/^http:/, 'https:');
            var iframe = document.createElement('iframe');
            iframe.style.display = 'none';
            iframe.src = httpsUrl + '/pwa/push-complete.html';
            document.body.appendChild(iframe);

            var done = false;
            var expectedOrigin3 = new URL(httpsUrl).origin;
            function onMsg(e) {
                if (done) return;
                if (!e.data) return;
                if (e.origin !== expectedOrigin3) return;
                if (e.data.type === 'push-ready') {
                    iframe.contentWindow.postMessage({ type: 'push-status-check' }, expectedOrigin3);
                } else if (e.data.type === 'push-status') {
                    done = true;
                    window.removeEventListener('message', onMsg);
                    setTimeout(function() { try { iframe.remove(); } catch(x) {} }, 500);
                    renderPushCard(e.data.permission, e.data.hasSubscription);
                }
            }
            window.addEventListener('message', onMsg);
            setTimeout(function() {
                if (!done) {
                    done = true;
                    window.removeEventListener('message', onMsg);
                    try { iframe.remove(); } catch(x) {}
                }
            }, 8000);
            return;
        }

        renderPushCard('unsupported', false);
    }

    function loadSettingsSystemLink() {
        var row = $('#settings-syslink-row');
        if (!row) return;

        var slHtml = '<div class="settings-card"><div class="settings-card-header"><div class="settings-card-title">' + iconLink + ' System LiNK</div></div>' +
            '<div class="settings-card-body"><div class="loader-spinner" style="margin:8px auto"></div></div></div>';
        var bwHtml = '<div class="settings-card"><div class="settings-card-header"><div class="settings-card-title">' + iconBandwidth + ' Bandwidth</div></div>' +
            '<div class="settings-card-body"><div class="loader-spinner" style="margin:8px auto"></div></div></div>';
        row.innerHTML = slHtml + bwHtml;

        NovaAPI.getSystemLink(function(err, data) {
            var body = '';
            var summary = '';
            if (err || !data) {
                body = '<p style="color:var(--text-muted);font-size:12px">Could not load SystemLink info</p>';
                summary = 'Unavailable';
            } else {
                var enabled = data.enabled ? 'Enabled' : 'Disabled';
                summary = enabled;
                body += settingsInfoRow('Status', enabled);
                if (data.username) body += settingsInfoRow('Username', data.username);
                var xip = data.xboxip || data.xboxIp || data.xbox_ip || '';
                var xmac = data.xboxmac || data.xboxMac || data.xbox_mac || '';
                var gip = data.gatewayip || data.gatewayIp || data.gateway_ip || '';
                var gmac = data.gatewaymac || data.gatewayMac || data.gateway_mac || '';
                var bport = data.broadcastport || data.broadcastPort || data.broadcast_port || '';
                var dport = data.dataport || data.dataPort || data.data_port || '';
                if (xip) body += settingsInfoRow('Xbox IP', xip);
                if (xmac) body += settingsInfoRow('Xbox MAC', xmac);
                if (gip) body += settingsInfoRow('Gateway IP', gip);
                if (gmac) body += settingsInfoRow('Gateway MAC', gmac);
                if (bport) body += settingsInfoRow('Broadcast Port', bport);
                if (dport) body += settingsInfoRow('Data Port', dport);
                if (data.apikey) body += settingsInfoRow('API Key', data.apikey);
            }
            var cardHtml = settingsCard('syslink', iconLink, 'System LiNK', summary, body, false);

            NovaAPI.getSystemLinkBandwidth(function(err2, bw) {
                var bwBody = '';
                var bwSummary = '';
                if (err2 || !bw) {
                    bwBody = '<p style="color:var(--text-muted);font-size:12px">Could not load bandwidth info</p>';
                    bwSummary = 'Unavailable';
                } else {
                    var rate = bw.rate || {};
                    var bytes = bw.bytes || {};
                    bwSummary = '&#8595; ' + (rate.downstream || 0).toFixed(2) + ' / &#8593; ' + (rate.upstream || 0).toFixed(2) + ' KB/s';
                    bwBody += settingsInfoRow('Download Rate', (rate.downstream || 0).toFixed(4) + ' KB/s');
                    bwBody += settingsInfoRow('Upload Rate', (rate.upstream || 0).toFixed(4) + ' KB/s');
                    bwBody += settingsInfoRow('Downloaded', formatBytes2(bytes.downstream || 0));
                    bwBody += settingsInfoRow('Uploaded', formatBytes2(bytes.upstream || 0));
                }
                var bwCardHtml = settingsCard('bandwidth', iconBandwidth, 'Bandwidth', bwSummary, bwBody, false);
                row.innerHTML = cardHtml + bwCardHtml;
                bindSettingsToggles(row);
            });
        });
    }

    function loadSettingsTemperatures() {
        var row = $('#settings-temp-row');
        if (!row) return;
        if (!state.temperature) {
            row.innerHTML = '';
            return;
        }
        var t = state.temperature;
        var cpuTemp = t.cpu || t.CPU || 0;
        var gpuTemp = t.gpu || t.GPU || 0;
        var memTemp = t.memory || t.mem || t.MEM || t.ram || t.RAM || 0;
        row.innerHTML = '<div class="settings-section-title">Temperatures <span class="refresh-indicator live"></span></div>' +
            '<div class="info-grid">' +
                renderTempCard('CPU', cpuTemp) +
                renderTempCard('GPU', gpuTemp) +
                renderTempCard('RAM', memTemp) +
            '</div>';
    }

    function loadSettingsDeviceSmc() {
        var row = $('#settings-device-row');
        if (!row) return;

        var deviceBody = '';
        var deviceSummary = '';
        if (state.systemInfo) {
            var s = state.systemInfo;
            var consoleType = s.ConsoleType || s.consoletype || (s.console && s.console.type) || '---';
            var motherboard = s.Motherboard || s.motherboard || (s.console && s.console.motherboard) || '---';
            var serial = s.ConsoleSerial || s.serial || '---';
            var consoleId = s.ConsoleId || s.consoleid || '---';
            var cpuKey = s.CPUKey || s.cpukey || '---';
            var dvdKey = s.DVDKey || s.dvdkey || '---';
            var kernel = s.Kernel || s.kernel || '';
            if (!kernel && s.version) {
                kernel = (s.version.major || 0) + '.' + (s.version.minor || 0) + '.' + (s.version.build || 0) + '.' + (s.version.qfe || 0);
            }
            deviceSummary = consoleType + ' &middot; ' + motherboard;
            deviceBody += settingsInfoRow('Console Type', consoleType);
            deviceBody += settingsInfoRow('Motherboard', motherboard);
            deviceBody += settingsInfoRow('Serial', serial);
            deviceBody += settingsInfoRow('Console ID', consoleId);
            deviceBody += settingsInfoRow('CPU Key', cpuKey);
            deviceBody += settingsInfoRow('Kernel', kernel || '---');
            deviceBody += settingsInfoRow('DVD Key', dvdKey);
        } else {
            deviceBody = '<p style="color:var(--text-muted);font-size:12px">No device info loaded</p>';
            deviceSummary = 'Loading...';
        }

        var smcBody = '';
        var smcSummary = '';
        if (state.smc) {
            var smc = state.smc;
            var smcKeys = Object.keys(smc);
            var smcVersion = smc.smcversion || smc.SMCVersion || '';
            smcSummary = smcVersion ? 'v' + smcVersion : smcKeys.length + ' entries';
            function flattenSmcObj(prefix, obj) {
                if (obj == null) { smcBody += settingsInfoRow(prefix, '---'); return; }
                if (Array.isArray(obj)) { smcBody += settingsInfoRow(prefix, obj.join(', ')); return; }
                if (typeof obj !== 'object') { smcBody += settingsInfoRow(prefix, obj); return; }
                Object.keys(obj).forEach(function(k) {
                    var label = prefix ? prefix + '.' + k : k;
                    var v = obj[k];
                    if (v != null && typeof v === 'object' && !Array.isArray(v)) {
                        flattenSmcObj(label, v);
                    } else {
                        smcBody += settingsInfoRow(label, safeStr(v));
                    }
                });
            }
            smcKeys.forEach(function(key) {
                flattenSmcObj(key, smc[key]);
            });
        } else {
            smcBody = '<p style="color:var(--text-muted);font-size:12px">No SMC info loaded</p>';
            smcSummary = 'Loading...';
        }

        row.innerHTML = settingsCard('device', iconDevice, 'Device', deviceSummary, deviceBody, false) +
            settingsCard('smc', iconChip, 'SMC', smcSummary, smcBody, false);
        bindSettingsToggles(row);
    }

    function loadSettingsPluginThreads() {
        var row = $('#settings-plugin-row');
        if (!row) return;

        row.innerHTML = '<div class="settings-card"><div class="settings-card-header"><div class="settings-card-title">' + iconPlugin + ' Plugin</div></div>' +
            '<div class="settings-card-body"><div class="loader-spinner" style="margin:8px auto"></div></div></div>' +
            '<div class="settings-card"><div class="settings-card-header"><div class="settings-card-title">' + iconThread + ' Active Threads</div></div>' +
            '<div class="settings-card-body"><div class="loader-spinner" style="margin:8px auto"></div></div></div>';

        NovaAPI.getPluginInfo(function(err, data) {
            var pluginBody = '';
            var pluginSummary = '';
            if (err || !data) {
                pluginBody = '<p style="color:var(--text-muted);font-size:12px">Could not load plugin info</p>';
                pluginSummary = 'Unavailable';
            } else {
                var ver = formatVersion(data.version);
                var apiVer = (data.version && data.version.api != null) ? data.version.api : '---';
                pluginSummary = 'v' + ver + ' (API ' + apiVer + ')';
                pluginBody += settingsInfoRow('Version', ver);
                pluginBody += settingsInfoRow('API Version', apiVer);

                if (data.path) {
                    var p = data.path;
                    if (p.root) pluginBody += settingsInfoRow('Root Path', p.root);
                    if (p.user) pluginBody += settingsInfoRow('User Path', p.user);
                    if (p.web) pluginBody += settingsInfoRow('Web Path', p.web);
                    if (p.launcher) pluginBody += settingsInfoRow('Launcher', p.launcher);
                }

                if (data.features) {
                    pluginBody += '<div style="padding-top:8px;font-size:11px;color:var(--text-muted);font-weight:600">FEATURES</div>';
                    pluginBody += '<div class="feature-grid">';
                    var feats = data.features;
                    Object.keys(feats).forEach(function(fk) {
                        var on = feats[fk] ? true : false;
                        pluginBody += '<div class="feature-item"><span class="feature-dot ' + (on ? 'enabled' : 'disabled') + '"></span>' + escapeHtml(fk) + '</div>';
                    });
                    pluginBody += '</div>';
                }
            }
            var pluginHtml = settingsCard('plugin', iconPlugin, 'Plugin', pluginSummary, pluginBody, false);

            NovaAPI.getThreads(function(err2, tdata) {
                var threadBody = '';
                var threadSummary = '';
                var threads = [];
                if (!err2 && tdata) {
                    if (Array.isArray(tdata)) threads = tdata;
                    else if (tdata.id != null) threads = [tdata];
                }

                if (threads.length === 0) {
                    threadBody = '<p style="color:var(--text-muted);font-size:12px">No active threads</p>';
                    threadSummary = 'None';
                } else {
                    threadSummary = threads.length + ' thread' + (threads.length > 1 ? 's' : '');
                    threadBody += '<div class="thread-list">';
                    threads.forEach(function(th) {
                        var stateNames = ['Ready', 'Running', 'Waiting', 'Suspended', 'Terminated'];
                        var stateStr = stateNames[th.state] || ('State ' + (th.state || 0));
                        threadBody += '<div class="thread-item">' +
                            '<span>' + escapeHtml(th.id || '---') + '</span>' +
                            '<span style="color:var(--text-muted)">P:' + (th.priority || 0) + '</span>' +
                            '<span style="color:' + (th.state === 1 ? 'var(--success)' : 'var(--text-secondary)') + '">' + stateStr + '</span>' +
                        '</div>';
                    });
                    threadBody += '</div>';
                }
                var threadHtml = settingsCard('threads', iconThread, 'Active Threads', threadSummary, threadBody, false);

                row.innerHTML = pluginHtml + threadHtml;
                bindSettingsToggles(row);
            });
        });
    }

    function loadSettingsDashLaunch() {
        var row = $('#settings-dashlaunch-row');
        if (!row) return;
        row.innerHTML = '<div class="settings-card"><div class="settings-card-header"><div class="settings-card-title">' + iconDashlaunch + ' DashLaunch</div></div>' +
            '<div class="settings-card-body"><div class="loader-spinner" style="margin:8px auto"></div></div></div>';

        NovaAPI.getDashLaunch(function(err, data) {
            var body = '';
            var summary = '';
            if (err || !data) {
                body = '<p style="color:var(--text-muted);font-size:12px">Could not load DashLaunch settings</p>';
                summary = 'Unavailable';
            } else {
                var ver = '';
                if (data.version) {
                    ver = formatVersion(data.version);
                    if (data.version.kernel) ver += ' (kernel ' + data.version.kernel + ')';
                    summary = 'v' + ver;
                    body += settingsInfoRow('Version', ver);
                }

                var options = data.options || [];
                if (Array.isArray(options) && options.length > 0) {
                    var categories = {};
                    var uncategorized = [];
                    options.forEach(function(opt) {
                        if (typeof opt === 'object' && opt !== null) {
                            var cat = opt.category || opt.Category || 'Other';
                            var name = opt.name || opt.Name || (opt.id != null ? String(opt.id) : '---');
                            var rawVal = opt.value != null ? opt.value : (opt.Value != null ? opt.Value : '---');
                            var val = safeStr(rawVal);
                            if (!categories[cat]) categories[cat] = [];
                            categories[cat].push({ name: name, value: val });
                        } else {
                            uncategorized.push(String(opt));
                        }
                    });

                    Object.keys(categories).forEach(function(cat) {
                        body += '<div class="dl-category">' + escapeHtml(cat) + '</div>';
                        categories[cat].forEach(function(item) {
                            body += '<div class="dl-option-row"><span class="dl-option-name">' + escapeHtml(item.name) + '</span><span class="dl-option-value">' + escapeHtml(String(item.value)) + '</span></div>';
                        });
                    });

                    if (uncategorized.length > 0) {
                        body += '<div class="dl-category">Options</div>';
                        uncategorized.forEach(function(v, i) {
                            body += '<div class="dl-option-row"><span class="dl-option-name">' + i + '</span><span class="dl-option-value">' + escapeHtml(v) + '</span></div>';
                        });
                    }

                    if (!summary) summary = options.length + ' options';
                } else if (typeof data === 'object') {
                    Object.keys(data).forEach(function(key) {
                        if (key === 'version' || key === 'options') return;
                        var val = data[key];
                        if (typeof val === 'object' && val !== null) {
                            body += '<div class="dl-category">' + escapeHtml(key) + '</div>';
                            Object.keys(val).forEach(function(k2) {
                                var v2 = val[k2];
                                if (typeof v2 === 'object' && v2 !== null) {
                                    body += '<div class="dl-option-row"><span class="dl-option-name">' + escapeHtml(k2) + '</span><span class="dl-option-value">' + escapeHtml(JSON.stringify(v2)) + '</span></div>';
                                } else {
                                    body += '<div class="dl-option-row"><span class="dl-option-name">' + escapeHtml(k2) + '</span><span class="dl-option-value">' + escapeHtml(String(v2)) + '</span></div>';
                                }
                            });
                        } else {
                            body += settingsInfoRow(key, val);
                        }
                    });
                }
            }
            body += '<div style="margin-top:10px;text-align:center">' +
                '<button class="btn dl-edit-btn" id="dl-edit-btn">' +
                iconDashlaunch + ' Editar DashLaunch</button></div>';
            row.innerHTML = settingsCard('dashlaunch', iconDashlaunch, 'DashLaunch', summary, body, false);
            bindSettingsToggles(row);
            var editBtn = document.getElementById('dl-edit-btn');
            if (editBtn) {
                editBtn.addEventListener('click', function() {
                    dlEditorStart();
                });
            }
        });
    }

    function dlParseIni(text) {
        var sections = [];
        var currentSection = null;
        var lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i];
            var trimmed = line.trim();
            if (trimmed === '' || trimmed.charAt(0) === ';' || trimmed.charAt(0) === '#') {
                continue;
            }
            var secMatch = trimmed.match(/^\[([^\]]+)\]$/);
            if (secMatch) {
                currentSection = { name: secMatch[1], entries: [] };
                sections.push(currentSection);
                continue;
            }
            var eqIdx = trimmed.indexOf('=');
            if (eqIdx !== -1) {
                var key = trimmed.substring(0, eqIdx).trim();
                var val = trimmed.substring(eqIdx + 1).trim();
                if (!currentSection) {
                    currentSection = { name: 'General', entries: [] };
                    sections.push(currentSection);
                }
                currentSection.entries.push({ key: key, value: val });
            }
        }
        return sections;
    }

    function dlSerializeIni(sections) {
        var lines = [];
        for (var i = 0; i < sections.length; i++) {
            var sec = sections[i];
            if (i > 0) lines.push('');
            lines.push('[' + sec.name + ']');
            for (var j = 0; j < sec.entries.length; j++) {
                var e = sec.entries[j];
                lines.push(e.key + ' = ' + e.value);
            }
        }
        return lines.join('\r\n') + '\r\n';
    }

    function dlIsBool(val) {
        var v = val.toLowerCase().trim();
        return v === 'true' || v === 'false';
    }

    function dlIsPath(key, val) {
        var k = key.toLowerCase();
        if (k.indexOf('plugin') !== -1 || k === 'default' || k === 'defaultalt' || k === 'configfile') return true;
        if (val.indexOf(':\\') !== -1 || val.indexOf(':/') !== -1) return true;
        return false;
    }

    function dlEditorStart() {
        var hasBridge = state.ftpBridgeConnected || state.xbdmBridgeConnected;
        if (!hasBridge) {
            dlShowAlert('Conectar File Manager', 'Para editar o DashLaunch, primeiro conecte o File Manager via FTP ou XBDM na página de Arquivos.');
            return;
        }
        dlShowFilePicker();
    }

    function dlShowAlert(title, msg) {
        var overlay = document.createElement('div');
        overlay.className = 'dl-editor-overlay';
        overlay.innerHTML = '<div class="dl-alert-box">' +
            '<div class="dl-alert-title">' + escapeHtml(title) + '</div>' +
            '<div class="dl-alert-msg">' + escapeHtml(msg) + '</div>' +
            '<button class="btn" id="dl-alert-ok" style="margin-top:12px;width:100%">OK</button>' +
        '</div>';
        document.body.appendChild(overlay);
        overlay.querySelector('#dl-alert-ok').addEventListener('click', function() {
            document.body.removeChild(overlay);
        });
        overlay.addEventListener('click', function(e) {
            if (e.target === overlay) document.body.removeChild(overlay);
        });
    }

    function dlShowFilePicker() {
        var overlay = document.createElement('div');
        overlay.className = 'dl-editor-overlay';
        var defaultPath = 'Hdd1:\\launch.ini';
        overlay.innerHTML = '<div class="dl-filepicker-box">' +
            '<div class="dl-alert-title">Localizar launch.ini</div>' +
            '<div style="margin:12px 0;font-size:12px;color:var(--text-secondary)">Informe o caminho do arquivo launch.ini no console ou navegue para encontrá-lo.</div>' +
            '<div class="dl-fp-input-row">' +
                '<input type="text" class="dl-fp-input" id="dl-fp-path" value="' + escapeHtml(defaultPath) + '" placeholder="Ex: Hdd1:\\launch.ini">' +
                '<button class="btn" id="dl-fp-browse" style="flex-shrink:0;padding:8px 12px" title="Navegar">📂</button>' +
            '</div>' +
            '<div class="dl-fp-browser hidden" id="dl-fp-browser-container"></div>' +
            '<div style="display:flex;gap:8px;margin-top:12px">' +
                '<button class="btn" id="dl-fp-cancel" style="flex:1;background:var(--bg-secondary)">Cancelar</button>' +
                '<button class="btn" id="dl-fp-open" style="flex:1">Abrir</button>' +
            '</div>' +
        '</div>';
        document.body.appendChild(overlay);
        overlay.addEventListener('click', function(e) {
            if (e.target === overlay) document.body.removeChild(overlay);
        });
        overlay.querySelector('#dl-fp-cancel').addEventListener('click', function() {
            document.body.removeChild(overlay);
        });
        overlay.querySelector('#dl-fp-open').addEventListener('click', function() {
            var p = overlay.querySelector('#dl-fp-path').value.trim();
            if (!p) return;
            document.body.removeChild(overlay);
            dlLoadFile(p);
        });
        var browseBtn = overlay.querySelector('#dl-fp-browse');
        browseBtn.addEventListener('click', function() {
            var container = overlay.querySelector('#dl-fp-browser-container');
            if (!container.classList.contains('hidden')) {
                container.classList.add('hidden');
                return;
            }
            container.classList.remove('hidden');
            dlBrowseDir(container, '/', overlay.querySelector('#dl-fp-path'));
        });
    }

    function dlBrowseDir(container, dirPath, pathInput) {
        container.innerHTML = '<div class="loader-spinner small" style="margin:12px auto"></div>';
        var listFn = state.xbdmBridgeConnected ? NovaAPI.xbdmList.bind(NovaAPI) : NovaAPI.ftpList.bind(NovaAPI);
        listFn(dirPath, function(err, items) {
            if (err || !items) {
                container.innerHTML = '<div style="font-size:12px;color:var(--danger);padding:8px">Erro ao listar: ' + escapeHtml(err ? err.message : 'unknown') + '</div>';
                return;
            }
            var html = '<div class="dl-browse-list">';
            if (dirPath !== '/') {
                html += '<div class="dl-browse-item dl-browse-dir" data-path="' + escapeHtml(dlGetParent(dirPath)) + '">⬆ ..</div>';
            }
            var sorted = items.slice().sort(function(a, b) {
                var aDir = a.type === 'directory' || (a.attributes && (a.attributes & 16)) ? 0 : 1;
                var bDir = b.type === 'directory' || (b.attributes && (b.attributes & 16)) ? 0 : 1;
                if (aDir !== bDir) return aDir - bDir;
                return (a.name || '').localeCompare(b.name || '');
            });
            for (var i = 0; i < sorted.length; i++) {
                var item = sorted[i];
                var isDir = item.type === 'directory' || (item.attributes && (item.attributes & 16));
                var displayName = item.name;
                var pathName = item.name;
                if (dirPath === '/' && state.xbdmBridgeConnected && isDir && !/:\s*$/.test(item.name)) {
                    pathName = item.name + ':';
                    displayName = item.name + ':';
                }
                var fullPath = dlJoinPath(dirPath, pathName);
                if (isDir) {
                    html += '<div class="dl-browse-item dl-browse-dir" data-path="' + escapeHtml(fullPath) + '">📁 ' + escapeHtml(displayName) + '</div>';
                } else {
                    html += '<div class="dl-browse-item dl-browse-file" data-path="' + escapeHtml(fullPath) + '">📄 ' + escapeHtml(displayName) + '</div>';
                }
            }
            html += '</div>';
            container.innerHTML = html;
            container.querySelectorAll('.dl-browse-dir').forEach(function(el) {
                el.addEventListener('click', function() {
                    dlBrowseDir(container, el.getAttribute('data-path'), pathInput);
                });
            });
            container.querySelectorAll('.dl-browse-file').forEach(function(el) {
                el.addEventListener('click', function() {
                    var fp = el.getAttribute('data-path');
                    if (state.xbdmBridgeConnected) {
                        fp = fp.replace(/\//g, '\\');
                        if (fp.charAt(0) === '\\') fp = fp.substring(1);
                        fp = fp.replace(/\\\\/g, '\\');
                    }
                    pathInput.value = fp;
                    container.classList.add('hidden');
                });
            });
        });
    }

    function dlGetParent(p) {
        var sep = p.indexOf('\\') !== -1 ? '\\' : '/';
        var parts = p.split(sep).filter(function(s) { return s !== ''; });
        if (parts.length <= 1) return '/';
        parts.pop();
        return sep === '/' ? '/' + parts.join('/') : parts.join('\\');
    }

    function dlJoinPath(base, name) {
        var sep = base.indexOf('\\') !== -1 ? '\\' : '/';
        if (base === '/') return '/' + name;
        return base.replace(/[\/\\]$/, '') + sep + name;
    }

    function dlLoadFile(filePath) {
        var overlay = document.createElement('div');
        overlay.className = 'dl-editor-overlay';
        overlay.innerHTML = '<div class="dl-alert-box"><div class="loader-spinner" style="margin:12px auto"></div><div style="font-size:12px;color:var(--text-secondary);text-align:center">Lendo ' + escapeHtml(filePath) + '...</div></div>';
        document.body.appendChild(overlay);

        var readFn;
        if (state.xbdmBridgeConnected) {
            readFn = NovaAPI.xbdmReadFile.bind(NovaAPI);
        } else {
            readFn = NovaAPI.ftpReadFile.bind(NovaAPI);
        }

        readFn(filePath, function(err, data) {
            document.body.removeChild(overlay);
            if (err || !data || typeof data.content !== 'string') {
                dlShowAlert('Erro', 'Não foi possível ler o arquivo: ' + (err ? err.message : 'resposta inválida'));
                return;
            }
            var sections = dlParseIni(data.content);
            if (sections.length === 0) {
                dlShowAlert('Erro', 'O arquivo não contém seções DashLaunch válidas.');
                return;
            }
            dlShowEditor(filePath, sections);
        });
    }

    function dlShowEditor(filePath, sections) {
        var overlay = document.createElement('div');
        overlay.className = 'dl-editor-overlay dl-editor-fullscreen';
        overlay.id = 'dl-editor-overlay';

        var html = '<div class="dl-editor">';
        html += '<div class="dl-editor-header">';
        html += '<div class="dl-editor-title">' + iconDashlaunch + ' Editar DashLaunch</div>';
        html += '<button class="dl-editor-close" id="dl-editor-close">&times;</button>';
        html += '</div>';

        html += '<div class="dl-editor-path">' + escapeHtml(filePath) + '</div>';

        html += '<div class="dl-editor-body" id="dl-editor-body">';
        for (var s = 0; s < sections.length; s++) {
            var sec = sections[s];
            html += '<div class="dl-section" data-section="' + s + '">';
            html += '<div class="dl-section-header" data-toggle-section="' + s + '">';
            html += '<span class="dl-section-name">' + escapeHtml(sec.name) + '</span>';
            html += '<span class="dl-section-count">' + sec.entries.length + '</span>';
            html += '<span class="dl-section-chevron">' + chevronDownSvg + '</span>';
            html += '</div>';
            html += '<div class="dl-section-body" id="dl-sec-body-' + s + '">';
            for (var e = 0; e < sec.entries.length; e++) {
                var entry = sec.entries[e];
                html += dlRenderEntry(s, e, entry.key, entry.value);
            }
            html += '<div class="dl-add-entry">';
            html += '<button class="btn dl-add-btn" data-section="' + s + '" style="font-size:11px;padding:4px 10px">+ Adicionar</button>';
            html += '</div>';
            html += '</div>';
            html += '</div>';
        }
        html += '<div style="padding:8px 12px">';
        html += '<button class="btn dl-add-btn" id="dl-add-section" style="font-size:11px;padding:6px 12px;width:100%;background:var(--bg-secondary)">+ Nova Seção</button>';
        html += '</div>';
        html += '</div>';

        html += '<div class="dl-editor-footer">';
        html += '<div class="dl-editor-status" id="dl-editor-status"></div>';
        html += '<div class="dl-editor-actions">';
        html += '<button class="btn" id="dl-save-btn">Salvar</button>';
        html += '<button class="btn" id="dl-restart-btn" style="background:var(--warning);color:#000">Reiniciar Aurora</button>';
        html += '</div>';
        html += '</div>';

        html += '</div>';
        overlay.innerHTML = html;
        document.body.appendChild(overlay);

        overlay.querySelector('#dl-editor-close').addEventListener('click', function() {
            document.body.removeChild(overlay);
        });

        overlay.querySelectorAll('.dl-section-header').forEach(function(hdr) {
            hdr.addEventListener('click', function() {
                var idx = hdr.getAttribute('data-toggle-section');
                var body = overlay.querySelector('#dl-sec-body-' + idx);
                var chev = hdr.querySelector('.dl-section-chevron');
                if (body.classList.contains('collapsed')) {
                    body.classList.remove('collapsed');
                    chev.classList.add('open');
                } else {
                    body.classList.add('collapsed');
                    chev.classList.remove('open');
                }
            });
        });

        dlBindEditorEvents(overlay, filePath, sections);
    }

    function dlRenderEntry(secIdx, entryIdx, key, value) {
        var id = 'dl-e-' + secIdx + '-' + entryIdx;
        var html = '<div class="dl-entry" data-section="' + secIdx + '" data-entry="' + entryIdx + '" id="' + id + '">';
        html += '<div class="dl-entry-header">';
        html += '<span class="dl-entry-key">' + escapeHtml(key) + '</span>';
        html += '<button class="dl-entry-remove" data-section="' + secIdx + '" data-entry="' + entryIdx + '" title="Remover">&times;</button>';
        html += '</div>';
        if (dlIsBool(value)) {
            var checked = value.toLowerCase().trim() === 'true';
            html += '<label class="dl-toggle">';
            html += '<input type="checkbox" class="dl-toggle-input" data-section="' + secIdx + '" data-entry="' + entryIdx + '"' + (checked ? ' checked' : '') + '>';
            html += '<span class="dl-toggle-slider"></span>';
            html += '<span class="dl-toggle-label">' + (checked ? 'true' : 'false') + '</span>';
            html += '</label>';
        } else if (dlIsPath(key, value)) {
            html += '<div class="dl-path-row">';
            html += '<input type="text" class="dl-entry-input dl-path-input" data-section="' + secIdx + '" data-entry="' + entryIdx + '" value="' + escapeHtml(value) + '">';
            html += '<button class="btn dl-path-browse" data-section="' + secIdx + '" data-entry="' + entryIdx + '" style="flex-shrink:0;padding:6px 10px;font-size:11px">📂</button>';
            html += '</div>';
        } else {
            html += '<input type="text" class="dl-entry-input" data-section="' + secIdx + '" data-entry="' + entryIdx + '" value="' + escapeHtml(value) + '">';
        }
        html += '</div>';
        return html;
    }

    function dlBindEditorEvents(overlay, filePath, sections) {
        overlay.addEventListener('change', function(e) {
            var target = e.target;
            if (target.classList.contains('dl-toggle-input')) {
                var s = parseInt(target.getAttribute('data-section'));
                var ei = parseInt(target.getAttribute('data-entry'));
                var newVal = target.checked ? 'true' : 'false';
                sections[s].entries[ei].value = newVal;
                var label = target.parentNode.querySelector('.dl-toggle-label');
                if (label) label.textContent = newVal;
            }
        });

        overlay.addEventListener('input', function(e) {
            var target = e.target;
            if (target.classList.contains('dl-entry-input')) {
                var s = parseInt(target.getAttribute('data-section'));
                var ei = parseInt(target.getAttribute('data-entry'));
                sections[s].entries[ei].value = target.value;
            }
        });

        overlay.addEventListener('click', function(e) {
            var target = e.target;
            if (target.classList.contains('dl-entry-remove') || target.closest('.dl-entry-remove')) {
                var btn = target.classList.contains('dl-entry-remove') ? target : target.closest('.dl-entry-remove');
                var s = parseInt(btn.getAttribute('data-section'));
                var ei = parseInt(btn.getAttribute('data-entry'));
                sections[s].entries.splice(ei, 1);
                dlRefreshEditorBody(overlay, sections);
            }
            if (target.classList.contains('dl-add-btn')) {
                var secI = parseInt(target.getAttribute('data-section'));
                if (!isNaN(secI)) {
                    var newKey = prompt('Nome da chave:');
                    if (newKey && newKey.trim()) {
                        var newVal = prompt('Valor:', 'false');
                        if (newVal === null) newVal = '';
                        sections[secI].entries.push({ key: newKey.trim(), value: newVal });
                        dlRefreshEditorBody(overlay, sections);
                    }
                }
            }
            if (target.id === 'dl-add-section') {
                var secName = prompt('Nome da seção:');
                if (secName && secName.trim()) {
                    sections.push({ name: secName.trim(), entries: [] });
                    dlRefreshEditorBody(overlay, sections);
                }
            }
            if (target.classList.contains('dl-path-browse') || target.closest('.dl-path-browse')) {
                var browseBtn = target.classList.contains('dl-path-browse') ? target : target.closest('.dl-path-browse');
                var bS = parseInt(browseBtn.getAttribute('data-section'));
                var bE = parseInt(browseBtn.getAttribute('data-entry'));
                dlOpenPathPicker(function(selectedPath) {
                    sections[bS].entries[bE].value = selectedPath;
                    dlRefreshEditorBody(overlay, sections);
                });
            }
        });

        overlay.querySelector('#dl-save-btn').addEventListener('click', function() {
            dlSaveFile(overlay, filePath, sections);
        });

        overlay.querySelector('#dl-restart-btn').addEventListener('click', function() {
            dlRestartAurora(overlay);
        });
    }

    function dlRefreshEditorBody(overlay, sections) {
        var body = overlay.querySelector('#dl-editor-body');
        if (!body) return;
        var html = '';
        for (var s = 0; s < sections.length; s++) {
            var sec = sections[s];
            html += '<div class="dl-section" data-section="' + s + '">';
            html += '<div class="dl-section-header" data-toggle-section="' + s + '">';
            html += '<span class="dl-section-name">' + escapeHtml(sec.name) + '</span>';
            html += '<span class="dl-section-count">' + sec.entries.length + '</span>';
            html += '<span class="dl-section-chevron open">' + chevronDownSvg + '</span>';
            html += '</div>';
            html += '<div class="dl-section-body" id="dl-sec-body-' + s + '">';
            for (var e = 0; e < sec.entries.length; e++) {
                var entry = sec.entries[e];
                html += dlRenderEntry(s, e, entry.key, entry.value);
            }
            html += '<div class="dl-add-entry">';
            html += '<button class="btn dl-add-btn" data-section="' + s + '" style="font-size:11px;padding:4px 10px">+ Adicionar</button>';
            html += '</div>';
            html += '</div>';
            html += '</div>';
        }
        html += '<div style="padding:8px 12px">';
        html += '<button class="btn dl-add-btn" id="dl-add-section" style="font-size:11px;padding:6px 12px;width:100%;background:var(--bg-secondary)">+ Nova Seção</button>';
        html += '</div>';
        body.innerHTML = html;

        body.querySelectorAll('.dl-section-header').forEach(function(hdr) {
            hdr.addEventListener('click', function() {
                var idx = hdr.getAttribute('data-toggle-section');
                var secBody = overlay.querySelector('#dl-sec-body-' + idx);
                var chev = hdr.querySelector('.dl-section-chevron');
                if (secBody.classList.contains('collapsed')) {
                    secBody.classList.remove('collapsed');
                    chev.classList.add('open');
                } else {
                    secBody.classList.add('collapsed');
                    chev.classList.remove('open');
                }
            });
        });
    }

    function dlSaveFile(overlay, filePath, sections) {
        var statusEl = overlay.querySelector('#dl-editor-status');
        var saveBtn = overlay.querySelector('#dl-save-btn');
        statusEl.textContent = 'Salvando...';
        statusEl.style.color = 'var(--text-secondary)';
        saveBtn.disabled = true;

        var content = dlSerializeIni(sections);
        var writeFn;
        if (state.xbdmBridgeConnected) {
            writeFn = NovaAPI.xbdmWriteFile.bind(NovaAPI);
        } else {
            writeFn = NovaAPI.ftpWriteFile.bind(NovaAPI);
        }

        writeFn(filePath, content, function(err, data) {
            saveBtn.disabled = false;
            if (err) {
                statusEl.textContent = 'Erro ao salvar: ' + err.message;
                statusEl.style.color = 'var(--danger)';
            } else {
                statusEl.textContent = 'Salvo com sucesso!';
                statusEl.style.color = 'var(--success)';
                setTimeout(function() { statusEl.textContent = ''; }, 3000);
            }
        });
    }

    function dlRestartAurora(overlay) {
        var restartBtn = overlay.querySelector('#dl-restart-btn');
        restartBtn.disabled = true;
        restartBtn.textContent = 'Reiniciando...';

        NovaAPI.getPluginInfo(function(err, data) {
            if (err || !data || !data.path || !data.path.launcher) {
                restartBtn.textContent = 'Erro!';
                restartBtn.style.background = 'var(--danger)';
                restartBtn.style.color = '#fff';
                setTimeout(function() {
                    restartBtn.disabled = false;
                    restartBtn.textContent = 'Reiniciar Aurora';
                    restartBtn.style.background = 'var(--warning)';
                    restartBtn.style.color = '#000';
                }, 2000);
                return;
            }
            var fullPath = data.path.launcher;
            var lastSlash = fullPath.lastIndexOf('\\');
            var dir = lastSlash !== -1 ? fullPath.substring(0, lastSlash) : fullPath;
            var exec = lastSlash !== -1 ? fullPath.substring(lastSlash + 1) : 'default.xex';
            NovaAPI.launchTitle({ directory: dir, executable: exec, type: 0 }, function(launchErr) {
                if (launchErr) {
                    restartBtn.textContent = 'Erro!';
                    restartBtn.style.background = 'var(--danger)';
                    restartBtn.style.color = '#fff';
                } else {
                    restartBtn.textContent = 'Reiniciado!';
                    restartBtn.style.background = 'var(--success)';
                    restartBtn.style.color = '#fff';
                }
                setTimeout(function() {
                    restartBtn.disabled = false;
                    restartBtn.textContent = 'Reiniciar Aurora';
                    restartBtn.style.background = 'var(--warning)';
                    restartBtn.style.color = '#000';
                }, 3000);
            });
        });
    }

    function dlOpenPathPicker(onSelect) {
        var overlay = document.createElement('div');
        overlay.className = 'dl-editor-overlay';
        overlay.style.zIndex = '3000';
        overlay.innerHTML = '<div class="dl-filepicker-box">' +
            '<div class="dl-alert-title">Selecionar Arquivo</div>' +
            '<div class="dl-fp-browser" id="dl-pp-browser" style="display:block"></div>' +
            '<button class="btn" id="dl-pp-cancel" style="margin-top:8px;width:100%;background:var(--bg-secondary)">Cancelar</button>' +
        '</div>';
        document.body.appendChild(overlay);
        overlay.addEventListener('click', function(e) {
            if (e.target === overlay) document.body.removeChild(overlay);
        });
        overlay.querySelector('#dl-pp-cancel').addEventListener('click', function() {
            document.body.removeChild(overlay);
        });
        var browser = overlay.querySelector('#dl-pp-browser');
        dlBrowseDirForPicker(browser, '/', overlay, onSelect);
    }

    function dlBrowseDirForPicker(container, dirPath, overlay, onSelect) {
        container.innerHTML = '<div class="loader-spinner small" style="margin:12px auto"></div>';
        var listFn = state.xbdmBridgeConnected ? NovaAPI.xbdmList.bind(NovaAPI) : NovaAPI.ftpList.bind(NovaAPI);
        listFn(dirPath, function(err, items) {
            if (err || !items) {
                container.innerHTML = '<div style="font-size:12px;color:var(--danger);padding:8px">Erro: ' + escapeHtml(err ? err.message : 'unknown') + '</div>';
                return;
            }
            var html = '<div class="dl-browse-list">';
            if (dirPath !== '/') {
                html += '<div class="dl-browse-item dl-browse-dir" data-path="' + escapeHtml(dlGetParent(dirPath)) + '">⬆ ..</div>';
            }
            var sorted = items.slice().sort(function(a, b) {
                var aDir = a.type === 'directory' || (a.attributes && (a.attributes & 16)) ? 0 : 1;
                var bDir = b.type === 'directory' || (b.attributes && (b.attributes & 16)) ? 0 : 1;
                if (aDir !== bDir) return aDir - bDir;
                return (a.name || '').localeCompare(b.name || '');
            });
            for (var i = 0; i < sorted.length; i++) {
                var item = sorted[i];
                var isDir = item.type === 'directory' || (item.attributes && (item.attributes & 16));
                var displayName = item.name;
                var pathName = item.name;
                if (dirPath === '/' && state.xbdmBridgeConnected && isDir && !/:\s*$/.test(item.name)) {
                    pathName = item.name + ':';
                    displayName = item.name + ':';
                }
                var fullPath = dlJoinPath(dirPath, pathName);
                if (isDir) {
                    html += '<div class="dl-browse-item dl-browse-dir" data-path="' + escapeHtml(fullPath) + '">📁 ' + escapeHtml(displayName) + '</div>';
                } else {
                    html += '<div class="dl-browse-item dl-browse-file" data-path="' + escapeHtml(fullPath) + '">📄 ' + escapeHtml(displayName) + '</div>';
                }
            }
            html += '</div>';
            container.innerHTML = html;
            container.querySelectorAll('.dl-browse-dir').forEach(function(el) {
                el.addEventListener('click', function() {
                    dlBrowseDirForPicker(container, el.getAttribute('data-path'), overlay, onSelect);
                });
            });
            container.querySelectorAll('.dl-browse-file').forEach(function(el) {
                el.addEventListener('click', function() {
                    var fp = el.getAttribute('data-path');
                    if (state.xbdmBridgeConnected) {
                        fp = fp.replace(/\//g, '\\');
                        if (fp.charAt(0) === '\\') fp = fp.substring(1);
                        fp = fp.replace(/\\\\/g, '\\');
                    }
                    document.body.removeChild(overlay);
                    onSelect(fp);
                });
            });
        });
    }

    function loadSettingsProfiles() {
        var grid = $('#settings-profiles-grid');
        if (!grid) return;

        var slots = getProfileSlots();
        renderProfileSlots(grid, slots, true);

        NovaAPI.getProfiles(function(err, data) {
            var profiles = [];
            if (!err && data) {
                if (Array.isArray(data)) profiles = data;
                else if (Array.isArray(data.profiles)) profiles = data.profiles;
                else if (data.gamertag || data.Gamertag) profiles = [data];
            }

            profiles.forEach(function(p, idx) {
                if (p && p.index == null) p.index = idx;
            });

            var activeProfiles = profiles.filter(function(p) {
                return p && (p.gamertag || p.Gamertag);
            });

            activeProfiles.forEach(function(p) {
                updateProfileSlot(p);
            });

            var updatedSlots = getProfileSlots();
            if (!grid) return;
            renderProfileSlots(grid, updatedSlots, false);
        });
    }

    function renderProfileSlots(container, slots, loading) {
        var html = '';
        var deleteSvgSmall = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

        if (slots.length === 0 && loading) {
            for (var e = 0; e < 2; e++) {
                html += '<div class="profile-slot">' +
                    '<div class="profile-slot-empty"><div class="loader-spinner" style="margin:0 auto 8px"></div>Carregando...</div>' +
                '</div>';
            }
        } else if (slots.length === 0) {
            for (var e2 = 0; e2 < 2; e2++) {
                html += '<div class="profile-slot profile-slot-disconnected">' +
                    '<div class="profile-slot-avatar-wrap">' +
                        '<div class="profile-slot-avatar-fallback profile-slot-avatar-mini">' +
                            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>' +
                        '</div>' +
                    '</div>' +
                    '<div class="profile-slot-disc-info">' +
                        '<div class="profile-gamertag" style="font-size:13px;color:var(--text-muted)">---</div>' +
                        '<div style="font-size:11px;color:var(--text-muted);margin-top:2px">' + I18n.t('settings_profile_login_hint') + '</div>' +
                    '</div>' +
                '</div>';
            }
        } else {
            for (var i = 0; i < slots.length; i++) {
                var slot = slots[i];
                var gt = slot.gamertag || '---';
                var isLive = slot.signedin || slot.SignedIn;
                var initial = gt[0] ? gt[0].toUpperCase() : '?';
                var pIdx = slot.index != null ? slot.index : 0;
                var slotXuid = slot.xuid || slot.Xuid || '';
                var imgUrl = NovaAPI.getProfileImageUrl(pIdx);

                html += '<div class="profile-slot' + (isLive ? ' active' : '') + '">' +
                    '<button class="profile-slot-delete" data-profile-delete="' + i + '" title="Remover do histórico">' + deleteSvgSmall + '</button>' +
                    '<div class="profile-slot-avatar-wrap">' +
                        '<img class="profile-slot-avatar" data-profile-slot-img="' + escapeHtml(imgUrl) + '" data-profile-live="' + (isLive ? '1' : '0') + '" data-profile-xuid="' + escapeHtml(slotXuid) + '" alt="" src="img/noboxart.svg">' +
                        '<div class="profile-slot-avatar-fallback" style="display:none">' + escapeHtml(initial) + '</div>' +
                    '</div>' +
                    '<div class="profile-gamertag">' + escapeHtml(gt) + '</div>' +
                    '<div class="profile-detail"><span style="color:var(--text-muted)">Gamerscore</span><span>' + (slot.gamerscore || 0) + '</span></div>' +
                    '<div class="profile-detail"><span style="color:var(--text-muted)">XUID</span><span style="font-family:monospace;font-size:11px">' + escapeHtml(slot.xuid || '---') + '</span></div>' +
                    '<div class="profile-detail"><span style="color:var(--text-muted)">Status</span><span style="color:' + (isLive ? 'var(--success, #22c55e)' : 'var(--text-muted)') + '">' + (isLive ? 'Online' : 'Offline') + '</span></div>' +
                    (slot.lastSeen && !isLive ? '<div class="profile-cached-badge">Salvo em cache</div>' : '') +
                '</div>';
            }
        }
        container.innerHTML = html;

        container.querySelectorAll('[data-profile-delete]').forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                var idx = parseInt(this.getAttribute('data-profile-delete'), 10);
                deleteProfileSlot(idx);
            });
        });

        container.querySelectorAll('.profile-slot-avatar[data-profile-slot-img]').forEach(function(img) {
            var slotUrl = img.getAttribute('data-profile-slot-img');
            var isLive = img.getAttribute('data-profile-live') === '1';
            var slotXuid = img.getAttribute('data-profile-xuid') || '';
            var slotFallback = img.nextElementSibling;
            if (!isLive) {
                img.style.display = 'none';
                if (slotFallback) slotFallback.style.display = 'flex';
                return;
            }
            NovaAPI.loadAuthImage(slotUrl, img, function() {
                if (img.src.indexOf('noboxart') !== -1) {
                    img.style.display = 'none';
                    if (slotFallback) slotFallback.style.display = 'flex';
                }
            }, slotXuid);
        });
    }

    function bindSettingsToggles(parent) {
        var headers = parent.querySelectorAll('.settings-card-header[data-toggle]');
        headers.forEach(function(header) {
            header.addEventListener('click', function() {
                var cardId = this.getAttribute('data-toggle');
                var card = document.getElementById(cardId);
                if (!card) return;
                var body = card.querySelector('.settings-card-body');
                var toggle = this.querySelector('.settings-card-toggle');
                if (!body) return;
                var isCollapsed = body.classList.contains('collapsed');
                if (isCollapsed) {
                    body.classList.remove('collapsed');
                    if (toggle) toggle.classList.add('open');
                } else {
                    body.classList.add('collapsed');
                    if (toggle) toggle.classList.remove('open');
                }
            });
        });
    }

    function refreshAllData() {
        var btn = $('#settings-refresh');
        if (btn) btn.textContent = 'Refreshing...';

        loadInitialData(function() {
            renderSettings();
        });
    }

    function loadCmsConfig() {
    }

    function loadInitialData(callback) {
        var pending = 7;
        function done() {
            pending--;
            if (pending <= 0 && callback) callback();
        }

        loadCmsConfig();

        NovaAPI.getSystemInfo(function(err, data) {
            if (!err) state.systemInfo = data;
            done();
        });

        NovaAPI.getTemperature(function(err, data) {
            if (!err) state.temperature = data;
            done();
        });

        NovaAPI.getMemory(function(err, data) {
            if (!err) state.memory = data;
            done();
        });

        NovaAPI.getSMCInfo(function(err, data) {
            if (!err) state.smc = data;
            done();
        });

        NovaAPI.getProfiles(function(err, data) {
            if (!err && data) {
                var profiles = Array.isArray(data) ? data : (data.profiles || [data]);
                profiles.forEach(function(p, idx) {
                    if (p && p.index == null) p.index = idx;
                });
                var active = profiles.find(function(p) { return p && (p.signedin || p.SignedIn); });
                if (!active && profiles.length > 0) active = profiles[0];
                if (active && (active.gamertag || active.Gamertag)) state.profile = active;
            }
            done();
        });

        NovaAPI.getTitleInfo(function(err, data) {
            if (!err) {
                state.title = data;
                var tid = data ? (data.titleid || data.TitleId || '') : '';
                state.lastTitleId = tid;
                if (!isDashboard(data) && tid) {
                    var saved = null;
                    try { saved = JSON.parse(localStorage.getItem('nova_title_start')); } catch(e) {}
                    if (saved && saved.titleId === tid && saved.startTime) {
                        state.titleStartTime = saved.startTime;
                    } else {
                        state.titleStartTime = Date.now();
                        try { localStorage.setItem('nova_title_start', JSON.stringify({ titleId: tid, startTime: state.titleStartTime })); } catch(e) {}
                    }
                    startPlaytimeAutoSave(tid);
                }
            }
            done();
        });

        NovaAPI.getScreencaptureList(function(err, data) {
            if (!err && data) {
                if (Array.isArray(data)) state.screenshots = data;
                else if (data.screenshots) state.screenshots = data.screenshots;
                else if (data.Captures) state.screenshots = data.Captures;
                else state.screenshots = [];
            }
            if (!screensFilterTid) {
                try {
                    var savedFilter = localStorage.getItem('nova_screens_filter_tid');
                    if (savedFilter) {
                        var tidMap = getScreenshotGameMap(state.screenshots || []);
                        if (tidMap[savedFilter]) screensFilterTid = savedFilter;
                    }
                } catch(e) {}
            }
            done();
        });
    }

    function loadGames() {
        NovaAPI.getTitlesJson(function(err, data) {
            if (!err && data) {
                if (Array.isArray(data)) state.games = data;
                else if (data.Games) state.games = data.Games;
                else if (data.titles) state.games = data.titles;
                else state.games = [];
            }
            loadCmsGamesIntoState(function() {
                if (state.currentPage === 'games') renderGames();
                if (state.currentPage === 'home') renderHome();
            });
            batchAutoRegisterGames();
        });
    }

    function loadCmsGamesIntoState(callback) {
        if (!state.isOnline) return callback();
        NovaAPI.getCmsGames({ limit: 200 }, function(err, data) {
            if (err || !data || !data.games) return callback();
            var consoleTitleIds = {};
            state.games.forEach(function(g) {
                var tid = getGameId(g);
                if (tid) consoleTitleIds[tid.toLowerCase()] = true;
            });
            var newGames = [];
            data.games.forEach(function(cg) {
                if (cg.title_id && consoleTitleIds[cg.title_id.toLowerCase()]) return;
                var platformTypeMap = { 'xbox360': '1', 'xbla': '2', 'arcade': '2', 'indie': '3', 'classic': '4', 'ogxbox': '4', 'homebrew': '5' };
                newGames.push({
                    Name: cg.title,
                    TitleId: cg.title_id || '',
                    ContentType: platformTypeMap[(cg.platform || '').toLowerCase()] || '1',
                    art: { boxartSmall: cg.cover_image || '', boxartLarge: cg.cover_image || '' },
                    _cmsOnly: true,
                    _cmsId: cg.id,
                    _publisher: cg.publisher || ''
                });
            });
            state.games = state.games.concat(newGames);
            callback();
        });
    }

    function showLogin(statusMsg) {
        hide($('#loading-overlay'));
        hide($('#main-content'));
        hide($('#bottom-nav'));
        show($('#login-screen'));
        var errorEl = $('#login-error');
        if (statusMsg && errorEl) {
            show(errorEl);
            errorEl.textContent = statusMsg;
            errorEl.style.color = statusMsg === I18n.t('login_logged_out') ? 'var(--text-muted)' : 'var(--danger)';
        } else if (errorEl) {
            hide(errorEl);
        }
        applyLoginLanguage();
        var usernameInput = $('#login-username');
        if (usernameInput) usernameInput.focus();
    }

    function showApp() {
        hide($('#loading-overlay'));
        hide($('#login-screen'));
        show($('#main-content'));
        show($('#bottom-nav'));
        updateNavLanguage();
    }

    function showConnectionError() {
        hide($('#loading-overlay'));
        hide($('#login-screen'));
        show($('#main-content'));
        show($('#bottom-nav'));
        updateNavLanguage();

        var topBarHtml = '<div class="home-topbar">' +
            '<button class="hb-avatar-btn" id="hb-avatar-btn" title="' + I18n.t('cms_login_title') + '">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="22" height="22"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>' +
            '</button>' +
            '<div class="hb-search-wrap">' +
                '<svg class="hb-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>' +
                '<input type="text" class="hb-search-input" id="hb-search-input" placeholder="' + escapeHtml(I18n.t('home_search_placeholder')) + '" autocomplete="off" autocapitalize="off" disabled>' +
            '</div>' +
            '<button class="hb-notif-btn" id="hb-notif-btn" title="' + I18n.t('home_notifications') + '">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>' +
            '</button>' +
        '</div>';

        $('#page-home').innerHTML = topBarHtml +
            '<div class="card" style="text-align:center;padding:32px;margin:16px">' +
                '<p style="color:var(--text-secondary);margin-bottom:16px">' + I18n.t('home_connect_error') + '</p>' +
                '<p style="color:var(--text-muted);font-size:12px;margin-bottom:16px">' + I18n.t('home_connect_hint') + '</p>' +
                '<button class="btn btn-primary" onclick="location.reload()">' + I18n.t('home_retry') + '</button>' +
            '</div>';
    }

    function onLoginSuccess() {
        showApp();
        state.systemInfo = NovaAPI.getCache().system;

        var startPage = getPageFromHash();

        if (isCmsLoggedIn()) {
            loadCmsProfileData();
        }

        var savedInitHash = window.location.hash.replace('#', '');
        loadInitialData(function() {
            navigateTo(startPage, true);
            var isInitNovidades = savedInitHash.indexOf('novidades/') === 0;
            var isInitNews = savedInitHash.indexOf('news/') === 0;
            if (isInitNovidades || isInitNews) {
                var initSlug = isInitNovidades ? savedInitHash.substring(10) : savedInitHash.substring(5);
                if (initSlug) {
                    NovaAPI.getBlogPosts(function(err, data) {
                        if (err || !data) return;
                        var posts = data.posts || [];
                        state._allBlogPosts = posts;
                        var match = posts.find(function(p) { return generateSlug(p.title || '') === initSlug; });
                        if (match) {
                            state._blogDetailActive = true;
                            state._currentBlogPost = match;
                            showBlogPostDetail(match, 'news');
                        }
                    });
                }
            }
        });

        loadGames();
        NovaAPI.startAutoRefresh(5000);

        NovaAPI.autoDiscoverXbdmBridge(function(err, url, data) {
            if (!err && url) {
                state.xbdmBridgeConnected = true;
                state.xbdmBridgeUrl = url;
                state.xbdmBridgeInfo = data;
                if (state.currentPage === 'home') renderHome();
            }
        });
    }

    var _listenersRegistered = false;
    function registerNovaListeners() {
        if (_listenersRegistered) return;
        _listenersRegistered = true;

        NovaAPI.on('temperature', function(data) {
            state.temperature = data;
            if (state.currentPage === 'home') {
                renderHome(true);
            }
            if (state.currentPage === 'settings') loadSettingsTemperatures();
        });

        NovaAPI.on('memory', function(data) {
            state.memory = data;
            if (state.currentPage === 'home') {
                renderHome(true);
            }
        });

        NovaAPI.on('title', function(data) {
            var newTid = data ? (data.titleid || data.TitleId || '') : '';
            var oldTid = state.lastTitleId || '';
            if (newTid !== oldTid) {
                if (oldTid && isCmsLoggedIn()) {
                    flushPlaytimeDelta(oldTid);
                }
                stopPlaytimeAutoSave();

                if (isDashboard(data)) {
                    state.titleStartTime = null;
                    try { localStorage.removeItem('nova_title_start'); } catch(e) {}
                    if (isCmsLoggedIn()) {
                        NovaAPI.cmsUpdateOnlineStatus(true, null);
                    }
                } else {
                    var saved = null;
                    try { saved = JSON.parse(localStorage.getItem('nova_title_start')); } catch(e) {}
                    if (saved && saved.titleId === newTid && saved.startTime) {
                        state.titleStartTime = saved.startTime;
                    } else {
                        state.titleStartTime = Date.now();
                        try { localStorage.setItem('nova_title_start', JSON.stringify({ titleId: newTid, startTime: state.titleStartTime })); } catch(e) {}
                    }
                    startPlaytimeAutoSave(newTid);
                    autoRegisterGameIfNeeded(newTid);
                    if (isCmsLoggedIn()) {
                        var onlineGameName = '';
                        var onlineMatchedG = findGameByTitleId(newTid);
                        if (onlineMatchedG) onlineGameName = getGameName(onlineMatchedG);
                        else if (data) onlineGameName = data.Name || data.name || '';
                        NovaAPI.cmsUpdateOnlineStatus(true, onlineGameName || null);
                    }
                }
                state.lastTitleId = newTid;
                screensFilterTid = null;

                NovaAPI.getScreencaptureList(function(scrErr, scrData) {
                    if (!scrErr && scrData) {
                        var fresh = [];
                        if (Array.isArray(scrData)) fresh = scrData;
                        else if (scrData.screenshots) fresh = scrData.screenshots;
                        else if (scrData.Captures) fresh = scrData.Captures;
                        var existing = state.screenshots || [];
                        var seen = {};
                        var merged = [];
                        existing.forEach(function(item) {
                            var key = (typeof item === 'string') ? item : (item.filename || item.uuid || '');
                            if (key && !seen[key]) { seen[key] = true; merged.push(item); }
                        });
                        fresh.forEach(function(item) {
                            var key = (typeof item === 'string') ? item : (item.filename || item.uuid || '');
                            if (key && !seen[key]) { seen[key] = true; merged.push(item); }
                        });
                        state.screenshots = merged;
                        if (state.currentPage === 'screens') renderScreens();
                    }
                });

                if (newTid && !isDashboard(data) && state.currentPage === 'games' && state.selectedGame) {
                    var detailTidOnTitle = getGameId(state.selectedGame);
                    if (detailTidOnTitle && detailTidOnTitle.toLowerCase() === newTid.toLowerCase()) {
                        var achSectionOnTitle = $('#achievements-section');
                        if (achSectionOnTitle) loadAchievements(detailTidOnTitle);
                    }
                }
            } else if (!state.titleStartTime && newTid && !isDashboard(data)) {
                var saved2 = null;
                try { saved2 = JSON.parse(localStorage.getItem('nova_title_start')); } catch(e) {}
                if (saved2 && saved2.titleId === newTid && saved2.startTime) {
                    state.titleStartTime = saved2.startTime;
                    if (!playtimeTickInterval) startPlaytimeAutoSave(newTid);
                }
            }
            state.title = data;
            if (state.currentPage === 'home') {
                renderHome(true);
            }
        });

        NovaAPI.on('notification', function(data) {
            if (!data) return;
            var prevNotif = state.notification;
            state.notification = data;

            if (prevNotif && data.title !== prevNotif.title) {
                if (state.currentPage === 'games' && state.selectedGame) {
                    var detailTid = getGameId(state.selectedGame);
                    var currentTid = getTitleIdFromState();
                    if (detailTid && currentTid && detailTid.toLowerCase() === currentTid.toLowerCase()) {
                        var achSection = $('#achievements-section');
                        if (achSection) loadAchievements(detailTid);
                    }
                }
            }

            if (prevNotif && data.achievements !== prevNotif.achievements) {
                if (state.currentPage === 'games' && state.selectedGame) {
                    var detailTid2 = getGameId(state.selectedGame);
                    var achSection2 = $('#achievements-section');
                    if (detailTid2 && achSection2) loadAchievements(detailTid2);
                }
            }
        });

        var sessionExpiredHandled = false;
        NovaAPI.on('session_expired', function() {
            if (sessionExpiredHandled) return;
            sessionExpiredHandled = true;
            NovaAPI.stopAutoRefresh();
            var remembered = getRememberedCredentials();
            if (remembered) {
                NovaAPI.authenticate(remembered.username, remembered.password, function(err, data) {
                    sessionExpiredHandled = false;
                    if (!err && data && data.token) {
                        NovaAPI.startAutoRefresh(5000);
                    } else {
                        clearRememberedCredentials();
                        NovaAPI.logout();
                        showLogin(I18n.t('login_session_expired'));
                    }
                });
            } else {
                NovaAPI.logout();
                showLogin(I18n.t('login_session_expired'));
            }
        });
    }

    function getRememberedCredentials() {
        try {
            var data = localStorage.getItem('nova_remember');
            if (!data) return null;
            var decoded = JSON.parse(atob(data));
            if (decoded && decoded.u && decoded.p) return { username: decoded.u, password: decoded.p };
        } catch(e) {}
        return null;
    }
    function saveRememberedCredentials(username, password) {
        try { localStorage.setItem('nova_remember', btoa(JSON.stringify({ u: username, p: password }))); } catch(e) {}
    }
    function clearRememberedCredentials() {
        try { localStorage.removeItem('nova_remember'); } catch(e) {}
    }

    function updateNavLanguage() {
        document.querySelectorAll('[data-nav-key]').forEach(function(el) {
            el.textContent = I18n.t(el.getAttribute('data-nav-key'));
        });
    }

    function applyLoginLanguage() {
        var lang = I18n.getLanguage();
        var langSelect = $('#login-language');
        if (langSelect) langSelect.value = lang;
        var usernameLabel = document.querySelector('label[for="login-username"]');
        if (usernameLabel) usernameLabel.textContent = I18n.t('login_username_label');
        var usernameInput = $('#login-username');
        if (usernameInput) usernameInput.placeholder = I18n.t('login_username_placeholder');
        var passwordLabel = document.querySelector('label[for="login-password"]');
        if (passwordLabel) passwordLabel.textContent = I18n.t('login_password_label');
        var passwordInput = $('#login-password');
        if (passwordInput) passwordInput.placeholder = I18n.t('login_password_placeholder');
        var rememberText = $('#login-remember-text');
        if (rememberText) rememberText.textContent = I18n.t('login_remember');
        var btnText = $('#login-btn-text');
        if (btnText) btnText.textContent = I18n.t('login_btn');
        var langLabel = $('#login-lang-label');
        if (langLabel) langLabel.textContent = I18n.t('login_language_label');
        var loaderText = document.querySelector('.loader-text');
        if (loaderText) loaderText.textContent = I18n.t('connecting');
        var subtitle = $('#login-subtitle');
        if (subtitle) subtitle.textContent = I18n.t('login_subtitle');
    }

    function setupLoginForm() {
        var form = $('#login-form');
        if (!form) return;

        var rememberCheckbox = $('#login-remember');
        var remembered = getRememberedCredentials();
        if (remembered) {
            $('#login-username').value = remembered.username;
            $('#login-password').value = remembered.password;
            if (rememberCheckbox) rememberCheckbox.checked = true;
        }

        applyLoginLanguage();

        var langSelect = $('#login-language');
        if (langSelect) {
            langSelect.addEventListener('change', function() {
                I18n.setLanguage(this.value);
                applyLoginLanguage();
            });
        }

        form.addEventListener('submit', function(e) {
            e.preventDefault();
            var username = $('#login-username').value.trim();
            var password = $('#login-password').value;
            var errorEl = $('#login-error');
            var btnText = $('#login-btn-text');
            var btnSpinner = $('#login-btn-spinner');
            var submitBtn = $('#login-submit');
            var shouldRemember = rememberCheckbox && rememberCheckbox.checked;

            if (!username) {
                show(errorEl);
                errorEl.textContent = I18n.t('login_error_empty');
                return;
            }

            hide(errorEl);
            hide(btnText);
            show(btnSpinner);
            submitBtn.disabled = true;

            NovaAPI.authenticate(username, password, function(err, data) {
                show(btnText);
                hide(btnSpinner);
                submitBtn.disabled = false;

                if (err || !data || !data.token) {
                    show(errorEl);
                    errorEl.textContent = I18n.t('login_error_invalid');
                    return;
                }

                if (shouldRemember) {
                    saveRememberedCredentials(username, password);
                } else {
                    clearRememberedCredentials();
                }

                NovaAPI.init(function(err2) {
                    if (err2) {
                        if (err2.loginRequired) {
                            show(errorEl);
                            errorEl.textContent = I18n.t('login_error_invalid');
                            return;
                        }
                        showConnectionError();
                        return;
                    }
                    onLoginSuccess();
                });
            });
        });
    }

    function init() {
        if (typeof GodStixPWA !== 'undefined') GodStixPWA.init();

        var loaderText = $('#loader-text');
        if (loaderText) loaderText.textContent = I18n.t('connecting');

        var loaderTimeout = setTimeout(function() {
            hide($('#loading-overlay'));
            if (typeof GodStixPWA !== 'undefined' && GodStixPWA.isStandalone()) {
                GodStixPWA.showReconnectScreen();
            } else {
                showConnectionError();
            }
        }, 10000);

        NovaAPI.init(function(err) {
            clearTimeout(loaderTimeout);

            if (err) {
                if (err.loginRequired) {
                    var remembered = getRememberedCredentials();
                    if (remembered) {
                        NovaAPI.authenticate(remembered.username, remembered.password, function(authErr, authData) {
                            if (!authErr && authData && authData.token) {
                                NovaAPI.init(function(err2) {
                                    if (err2) { showLogin(I18n.t('login_session_expired')); return; }
                                    onLoginSuccess();
                                });
                            } else {
                                clearRememberedCredentials();
                                NovaAPI.logout();
                                showLogin(I18n.t('login_session_expired'));
                            }
                        });
                    } else if (NovaAPI.isAuthenticated()) {
                        NovaAPI.logout();
                        showLogin(I18n.t('login_session_expired'));
                    } else {
                        showLogin();
                    }
                } else {
                    if (typeof GodStixPWA !== 'undefined' && GodStixPWA.isStandalone()) {
                        GodStixPWA.showReconnectScreen();
                    } else {
                        showConnectionError();
                    }
                }
                return;
            }

            if (typeof GodStixPWA !== 'undefined') {
                GodStixPWA.saveIp(window.location.hostname);
            }

            onLoginSuccess();
        });

        registerNovaListeners();
        setupLoginForm();

        $$('.nav-item').forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                if (this.dataset.page === 'profile') {
                    e.stopPropagation();
                    togglePerfilSubmenu();
                    return;
                }
                if (this.dataset.page === 'home') {
                    e.stopPropagation();
                    toggleHomeSubmenu();
                    return;
                }
                navigateTo(this.dataset.page);
            });
        });

        $$('.sidebar-link').forEach(function(link) {
            link.addEventListener('click', function() {
                navigateTo(this.dataset.page);
            });
        });

        $('#sidebar-overlay').addEventListener('click', closeSidebar);
        $('#sidebar-close').addEventListener('click', closeSidebar);

        $('#viewer-close').addEventListener('click', closeImageViewer);
        $('.image-viewer-backdrop').addEventListener('click', closeImageViewer);

        window.addEventListener('hashchange', function() {
            var h = window.location.hash.replace('#', '');
            var isNovidadesSlug = h.indexOf('novidades/') === 0;
            var isNewsSlug = h.indexOf('news/') === 0;
            if ((isNovidadesSlug || isNewsSlug) && state._blogDetailActive) {
                return;
            }
            if (isNovidadesSlug || isNewsSlug) {
                var targetSlug = isNovidadesSlug ? h.substring(10) : h.substring(5);
                if (state.currentPage !== 'news') navigateTo('news', true);
                var cachedPosts = state._allBlogPosts || state._heroBlogPosts || [];
                var found = cachedPosts.find(function(p) { return generateSlug(p.title || '') === targetSlug; });
                if (found) {
                    state._blogDetailActive = true;
                    state._currentBlogPost = found;
                    showBlogPostDetail(found, 'news');
                } else {
                    NovaAPI.getBlogPosts(function(err, data) {
                        if (err || !data) return;
                        var posts = data.posts || [];
                        state._allBlogPosts = posts;
                        var match = posts.find(function(p) { return generateSlug(p.title || '') === targetSlug; });
                        if (match) {
                            state._blogDetailActive = true;
                            state._currentBlogPost = match;
                            showBlogPostDetail(match, 'news');
                        } else {
                            renderNews();
                        }
                    });
                }
                return;
            }
            if ((h === 'news' || h === 'novidades') && state._blogDetailActive) {
                state._blogDetailActive = false;
                state._currentBlogPost = null;
                renderNews();
                return;
            }
            var page = getPageFromHash();
            if (page !== state.currentPage) navigateTo(page, true);
        });

        window.addEventListener('online', function() {
            checkOnlineStatus();
        });
        window.addEventListener('offline', function() {
            setOnlineState(false);
        });

        window.addEventListener('beforeunload', function() {
            if (isCmsLoggedIn()) {
                var cmsUrl = NovaAPI.getCmsUrl();
                var token = NovaAPI.getCmsAuthToken();
                if (cmsUrl && token) {
                    try {
                        var xhr = new XMLHttpRequest();
                        xhr.open('POST', cmsUrl + '/api/profile/online-status', false);
                        xhr.setRequestHeader('Content-Type', 'application/json');
                        xhr.setRequestHeader('Authorization', 'Bearer ' + token);
                        xhr.send(JSON.stringify({ is_online: false, current_game_title: null }));
                    } catch(e) {}
                }
            }
        });

        checkOnlineStatus();
    }

    return { init: init };
})();

document.addEventListener('DOMContentLoaded', App.init);
