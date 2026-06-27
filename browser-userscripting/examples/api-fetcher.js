// ==UserScript==
// @name        GitHub Repo Stars
// @namespace   https://github.com/example/userscripts
// @version     1.0.0
// @description Fetch and display star count from GitHub API on repository pages
// @author      Example Author
// @match       *://github.com/*/*
// @grant       GM_xmlhttpRequest
// @grant       GM_addStyle
// @connect     api.github.com
// @run-at      document-idle
// @noframes
// ==/UserScript==

(function() {
  'use strict';

  const PANEL_ID = 'gh-stars-panel';

  GM_addStyle(`
    #${PANEL_ID} {
      position: fixed;
      bottom: 16px;
      right: 16px;
      z-index: 99999;
      background: #0d1117;
      color: #c9d1d9;
      border: 1px solid #30363d;
      border-radius: 6px;
      padding: 12px 16px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
      font-size: 13px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
      max-width: 280px;
    }
    #${PANEL_ID} .stars-title {
      font-weight: 600;
      margin-bottom: 6px;
      color: #f0f6fc;
    }
    #${PANEL_ID} .stars-count {
      font-size: 20px;
      font-weight: 700;
      color: #f9826c;
    }
    #${PANEL_ID} .stars-error {
      color: #f85149;
    }
    #${PANEL_ID} .stars-close {
      position: absolute;
      top: 4px;
      right: 8px;
      cursor: pointer;
      color: #8b949e;
      background: none;
      border: none;
      font-size: 16px;
    }
  `);

  // Extract owner/repo from URL path
  const pathParts = location.pathname.split('/').filter(Boolean);
  if (pathParts.length < 2) return;

  const owner = pathParts[0];
  const repo = pathParts[1];

  // Skip non-repo pages (settings, org pages, etc.)
  if (['settings', 'organizations', 'login', 'signup'].includes(owner)) return;

  fetchRepoData(owner, repo);

  function fetchRepoData(owner, repo) {
    GM_xmlhttpRequest({
      method: 'GET',
      url: `https://api.github.com/repos/${owner}/${repo}`,
      headers: {
        'Accept': 'application/vnd.github.v3+json',
      },
      responseType: 'json',
      onload: function(response) {
        if (response.status === 200) {
          showPanel(response.response);
        } else if (response.status === 404) {
          // Not a repo page — silently do nothing
        } else {
          showError(`API returned ${response.status}`);
        }
      },
      onerror: function(error) {
        showError('Network error');
      },
    });
  }

  function showPanel(repoData) {
    // Remove existing panel if present
    const existing = document.getElementById(PANEL_ID);
    if (existing) existing.remove();

    const panel = document.createElement('div');
    panel.id = PANEL_ID;

    const title = document.createElement('div');
    title.className = 'stars-title';
    title.textContent = `${repoData.full_name}`;
    panel.appendChild(title);

    const stats = document.createElement('div');
    const starCount = repoData.stargazers_count.toLocaleString();
    const forkCount = repoData.forks_count.toLocaleString();
    stats.innerHTML = ''; // Clear first
    const starsSpan = document.createElement('span');
    starsSpan.className = 'stars-count';
    starsSpan.textContent = `★ ${starCount}`;
    stats.appendChild(starsSpan);
    stats.appendChild(document.createTextNode(` stars · ${forkCount} forks`));
    panel.appendChild(stats);

    if (repoData.description) {
      const desc = document.createElement('div');
      desc.style.marginTop = '6px';
      desc.style.color = '#8b949e';
      desc.textContent = repoData.description;
      panel.appendChild(desc);
    }

    const closeBtn = document.createElement('button');
    closeBtn.className = 'stars-close';
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', () => panel.remove());
    panel.appendChild(closeBtn);

    document.body.appendChild(panel);
  }

  function showError(message) {
    const panel = document.createElement('div');
    panel.id = PANEL_ID;

    const errorDiv = document.createElement('div');
    errorDiv.className = 'stars-error';
    errorDiv.textContent = message;
    panel.appendChild(errorDiv);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'stars-close';
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', () => panel.remove());
    panel.appendChild(closeBtn);

    document.body.appendChild(panel);
  }
})();
