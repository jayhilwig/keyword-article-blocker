# Keyword Article Blocker

Keyword Article Blocker is a lightweight Chrome extension that hides individual news cards and articles when they match keyword rules you control.

It is built for people who want less repetitive coverage in their feeds without blocking an entire website. Instead of turning off a site, the extension looks for the article or card that contains a matching keyword and replaces that item with a small hidden-article placeholder.

## Features

- Hide individual articles and cards by keyword
- Use preset rules for common high-volume topics
- Add your own custom keyword rules
- Edit, enable, disable, or delete rules from the Options page
- Reveal a hidden article with the `Show` button
- Keep the rest of the page layout usable where possible
- Store rules and preferences locally with Chrome storage
- Manifest V3 extension
- No account required

## Why This Exists

Generic keyword blockers often miss modern article-card layouts, especially on news sites with hydrated content, mixed card structures, sidebars, and feed modules. Keyword Article Blocker focuses on finding a reasonable article/card container so the matched item can be hidden without breaking the whole page.

It is intentionally narrow. It is for reducing repeated topics in article feeds, not for blocking every possible mention of a word across a page.

## Privacy

Keyword Article Blocker does not collect, sell, or share personal data.

The extension does not send browsing history, page content, keyword rules, or user identifiers to external servers. Rules and preferences are stored locally using `chrome.storage.local`.

## How It Works

1. You enable preset rules or create your own keyword rules.
2. The content script scans supported pages in your browser.
3. When a keyword appears inside an article/card, that container is hidden.
4. A small placeholder is shown with the matched rule and keyword.
5. Click `Show` to reveal the article when you want to read it.

## Install From Source

1. Download or clone this repository.
2. Open Chrome and go to `chrome://extensions`.
3. Enable `Developer mode`.
4. Click `Load unpacked`.
5. Select the extension folder.

## Managing Rules

Open the extension Options page to manage rules.

From Options you can:

- Add a custom keyword rule
- Edit rule patterns
- Enable or disable individual rules
- Delete custom rules
- Reset presets to defaults
- Apply changes

## What It Does Not Do

Keyword Article Blocker does not block:

- Ads
- Cookie banners
- Newsletter popups
- Checkout flows
- Search engine result pages
- Full chat applications
- Feedback widgets
- Entire websites by default

Some websites use unusual markup or change frequently, so individual sites may not behave perfectly.

## Permissions

The extension uses Chrome permissions for local storage and page-level operation.

- `storage`: saves rules, enabled states, and preferences locally.
- Host access: allows the extension to scan visible page text and hide matching article/card containers.

No matched content or browsing activity is transmitted to any external service.

## Project Structure

```text
manifest.json      Extension manifest
background.js      Extension background behavior
defaults.js        Shared default rules and storage keys
content.js         Page scanning and article/card hiding logic
content.css        Styles injected into webpages for hidden placeholders
options.html       Options page markup
options.css        Options page styling
options.js         Options page behavior
popup.html         Popup markup, if used
popup.js           Popup behavior, if used
brand.png          Extension branding asset
```

## Feedback

Bug reports and site-specific issues are welcome through GitHub Issues:

https://github.com/jayhilwig/keyword-article-blocker/issues
