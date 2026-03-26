/**
 * ICF Collect — Session Persistence Plugin
 * =========================================
 * Compatible with this app's script.js.
 *
 * Your app ALREADY handles:
 *   ✓ Login / Signup / Logout
 *   ✓ Form credentials (add/remove)
 *   ✓ Share URL with embedded credentials
 *   ✓ Shared form login gate (validateSharedLogin)
 *
 * This plugin ONLY adds:
 *   + One-time device session — user signs in once on shared form,
 *     stays signed in until they click Logout (no re-login on refresh)
 *   + Logout button on the form after signing in
 */

(function () {
    'use strict';

    var SESSION_KEY_PREFIX = 'icf_session_';

    // ── Patch checkUrlForm to restore existing session ──────────────
    // Wait for the app's own init() to run first, then patch
    document.addEventListener('DOMContentLoaded', function () {
        // Give script.js init() time to run
        setTimeout(_patchSharedFormLogin, 100);
    });

    function _patchSharedFormLogin() {

        // Hook validateSharedLogin to save session on success
        var _origValidate = window.validateSharedLogin;
        if (typeof _origValidate === 'function') {
            window.validateSharedLogin = function () {
                var username = (document.getElementById('sharedUsername') || {}).value || '';
                var password = (document.getElementById('sharedPassword') || {}).value || '';

                // Run original validation
                _origValidate.apply(this, arguments);

                // If it succeeded (form questions appeared shortly after),
                // save the session. We detect success by checking after a short delay.
                var formTitle = (window.sharedFormData && window.sharedFormData.title) || 'form';
                var sessionKey = SESSION_KEY_PREFIX + _slugify(formTitle);
                var creds = (window.sharedFormData && window.sharedFormData.credentials) || [];
                var match = creds.find(function (c) {
                    return c.username.toLowerCase() === username.toLowerCase() && c.password === password;
                });
                if (match) {
                    try {
                        localStorage.setItem(sessionKey, JSON.stringify({
                            username: match.username,
                            loginTime: new Date().toISOString()
                        }));
                    } catch (e) {}
                }
            };
        }

        // Hook renderSharedFormQuestions to add logout button
        var _origRender = window.renderSharedFormQuestions;
        if (typeof _origRender === 'function') {
            window.renderSharedFormQuestions = function (loggedInUser) {
                _origRender.apply(this, arguments);
                // Add logout button after render
                setTimeout(function () {
                    _addLogoutButton(loggedInUser);
                }, 50);
            };
        }

        // Hook checkUrlForm to auto-skip login if valid session exists
        var _origCheck = window.checkUrlForm;
        if (typeof _origCheck === 'function') {
            window.checkUrlForm = function () {
                var params = new URLSearchParams(window.location.search);
                if (!params.get('form')) return false;

                // Decode form data to get title + credentials
                try {
                    var encoded = params.get('form');
                    var decoded = decodeURIComponent(escape(atob(encoded)));
                    var data = JSON.parse(decoded);

                    // Check for valid session
                    if (data.credentials && data.credentials.length > 0) {
                        var sessionKey = SESSION_KEY_PREFIX + _slugify(data.title || 'form');
                        var saved = null;
                        try { saved = JSON.parse(localStorage.getItem(sessionKey)); } catch (e) {}

                        if (saved && data.credentials.some(function (c) { return c.username === saved.username; })) {
                            // Valid session — skip login gate, go straight to form
                            // Let original checkUrlForm run to set up sharedFormData
                            var result = _origCheck.apply(this, arguments);
                            // Then skip straight to form questions
                            setTimeout(function () {
                                if (window.sharedFormData) {
                                    window.renderSharedFormQuestions(saved.username);
                                }
                            }, 50);
                            return result;
                        }
                    }
                } catch (e) {}

                // No session — run normally (shows login gate)
                return _origCheck.apply(this, arguments);
            };
        }
    }

    // Add a logout button to the form header after rendering
    function _addLogoutButton(username) {
        if (!username) return;
        var formTitle = (window.sharedFormData && window.sharedFormData.title) || 'form';
        var sessionKey = SESSION_KEY_PREFIX + _slugify(formTitle);

        // Find the form header and add a logout button if not already there
        var header = document.querySelector('.shared-form-header');
        if (header && !document.getElementById('sessionLogoutBtn')) {
            var btn = document.createElement('button');
            btn.id = 'sessionLogoutBtn';
            btn.textContent = 'Logout';
            btn.style.cssText = [
                'padding: 6px 14px',
                'background: #dc3545',
                'color: white',
                'border: none',
                'border-radius: 4px',
                'cursor: pointer',
                'font-size: 12px',
                'margin-left: auto',
                'display: block'
            ].join(';');
            btn.onclick = function () {
                try { localStorage.removeItem(sessionKey); } catch (e) {}
                // Reload page to show login gate again
                window.location.reload();
            };
            header.appendChild(btn);
        }
    }

    function _slugify(str) {
        return String(str || '').toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    }

})();
