# Visual Linux

Visual Linux is a collection of self-contained, browser-based command labs for learning Linux through an interactive filesystem map instead of a static command list.

Each playground gives you a terminal, a guided mission bar, hints, and a visual model of the filesystem. Commands change the map in real time so their effects are easier to remember.

## Start here

Open [`index.html`](index.html) in a browser, or start a small local server from this folder:

```bash
python3 -m http.server 8000
```

Then visit `http://127.0.0.1:8000/` in your browser. There is no build step, package install, or external dependency.

## Command labs

| # | Command | What you will practice | Open |
| --- | --- | --- | --- |
| 01 | `ls` | Directory listings, hidden files, file types, long output, and sorting | [Launch `ls`](ls.html) |
| 02 | `pwd` | Current location, logical and physical paths, breadcrumbs, and route history | [Launch `pwd`](pwd.html) |
| 03 | `cd` | Relative paths, `~`, `..`, absolute paths, and the previous directory | [Launch `cd`](cd.html) |
| 04 | `cat` | Reading text files, line numbers, multiple files, and path resolution | [Launch `cat`](cat.html) |
| 05 | `mkdir` | Creating directories, missing parents with `-p`, verbose output, and map mutations | [Launch `mkdir`](mkdir.html) |
| 06 | `cp` | Copying files and directories, preserving originals, and source-to-destination animation | [Launch `cp`](cp.html) |
| 07 | `grep` | Searching text, case-insensitive matching, line numbers, counts, and recursive search | [Launch `grep`](grep.html) |

## How the labs work

Every command page includes:

- A simulated Linux filesystem with folders and files.
- A terminal that accepts commands and displays readable feedback.
- Six progressive missions with optional hints.
- A visual panel that responds to command state.
- Responsive layouts for desktop, tablet, and mobile screens.
- Reduced-motion support through `prefers-reduced-motion`.
- No network calls, accounts, tracking, or server-side state.

The filesystem is intentionally in-memory. Refreshing a lab resets its virtual filesystem.

## Publish with GitHub Pages

1. Put the contents of this folder in the root of a GitHub repository.
2. Commit `index.html`, `README.md`, and the seven command pages.
3. In the repository, open **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Select the publishing branch and the `/ (root)` folder.
6. GitHub will provide the Pages address after the first deployment.

The relative links in `index.html` and this README work both on GitHub Pages and from a local static server.

## Project structure

```text
.
├── index.html       # Responsive landing page
├── README.md        # Project documentation
├── list.md          # Planned command sequence
├── cd.html          # Filesystem navigation lab
├── cp.html          # Copying lab
├── cat.html         # File-reading lab
├── grep.html        # Search lab
├── ls.html          # Directory-listing lab
├── mkdir.html       # Directory-creation lab
└── pwd.html         # Current-directory lab
```

## Local development

The pages use inline HTML, CSS, and JavaScript. To make a change:

1. Edit the relevant `.html` file.
2. Refresh the page in a browser.
3. Use the terminal form or command chips to test the interaction.
4. Check the browser console for runtime errors.
5. Test the layout at desktop and mobile widths.

A local server is optional, but useful for testing the pages under the same URL structure used by GitHub Pages:

```bash
python3 -m http.server 8000 --directory .
```
