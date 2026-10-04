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
| 07 | `mv` | Renaming in place, moving into folders, whole-folder moves, and safe overwrites | [Launch `mv`](mv.html) |
| 08 | `rm` | Deleting files and folders, recursive removal, interactive prompts, wildcards, and undo | [Launch `rm`](rm.html) |
| 09 | `find` | Searching by name, type, size, depth, and path patterns across a whole tree | [Launch `find`](find.html) |
| 10 | `sed` | Stream editing with `s///`, global and nth-occurrence flags, line and range addresses, `d` and `p`, `-i` in-place edits, and `.bak` backups | [Launch `sed`](sed.html) |
| 11 | `cut` | Extracting fields with `-d` and `-f`, field ranges, fixed columns with `-c`, and skipping undelimited lines with `-s` | [Launch `cut`](cut.html) |
| 12 | `head` / `tail` | Reading the first or last lines of a file, `-n` line counts, `+N` offsets, `-c` byte counts, and following a growing log with `-f` | [Launch `head` / `tail`](head_tail.html) |
| 13 | `wc` | Counting lines with `-l`, words with `-w`, bytes with `-c`, characters with `-m`, the longest line with `-L`, and totals across files | [Launch `wc`](wc.html) |
| 14 | `sort` / `uniq` | Sorting with `-n`, `-r`, `-u`, `-f`, `-b`, field keys with `-t` and `-k`, writing results with `-o`, checking order with `-c`, and collapsing repeats with `uniq -c`, `-d`, `-u`, `-i` | [Launch `sort` / `uniq`](sort_uniq.html) |
| 15 | `chmod` | Symbolic modes like `u+x` and `g-w`, exact sets like `u=rw,g=r,o=`, octal modes like `644`, recursive changes with `-R`, and several files at once | [Launch `chmod`](chmod.html) |
| 16 | `\|` and `>` `>>` | Piping one command's output into the next, writing results to a file with `>`, appending with `>>`, and chaining stages like `cat FILE \| grep ERROR \| wc -l` | [Launch pipes](pipes.html) |
| 17 | `grep` | Searching text, case-insensitive matching, line numbers, counts, and recursive search | [Launch `grep`](grep.html) |
| 18 | `df` | Reading filesystem disk usage, human-readable sizes with `-h`, and spotting a full mount | [Launch `df`](df.html) |
| 19 | `du` | Estimating file and folder space with `-s`, `-a`, and `-h`, and finding the biggest space hog | [Launch `du`](du.html) |
| 20 | `ps` | Listing running processes with `aux` and `-ef`, and isolating a runaway process | [Launch `ps`](ps.html) |
| 21 | `awk` | Scanning text line by line, fields `$1`–`$NF` and `$0`, the `-F` field separator, patterns and comparisons like `$3 > 100`, pattern-plus-action rules, and summing a column with `END` | [Launch `awk`](awk.html) |
| 22 | `tr` | Translating characters with `SET1` and `SET2`, ranges like `a-z`, character classes like `[:upper:]`, deleting with `-d`, squeezing repeats with `-s`, complementing with `-c`, truncating with `-t`, and feeding `tr` through `<`, `\|` and `>` | [Launch `tr`](tr.html) |

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
2. Commit `index.html`, `README.md`, and the twenty-two command pages.
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
├── mv.html          # Move and rename lab
├── rm.html          # Delete-and-restore lab
├── find.html        # Tree search lab
├── cat.html         # File-reading lab
├── sed.html         # Stream editor lab
├── cut.html         # Field and column slicing lab
├── head_tail.html   # Top and bottom of a file lab
├── wc.html          # Line, word and byte counting lab
├── sort_uniq.html   # Sort and deduplicate lab
├── chmod.html       # Permission matrix lab
├── pipes.html       # Pipeline and redirection lab
├── grep.html        # Search lab
├── df.html          # Disk-usage overview lab
├── du.html          # Space-hog hunt lab
├── ps.html          # Process monitor lab
├── awk.html         # Field-scanning and column-math lab
├── tr.html          # Character translate, delete and squeeze lab
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
