<p align="center">
  <img height="200" src="https://github.com/XadillaX/vscode-language-viml/raw/master/assets/README.png" />
</p>

<p align="center">
  <a href="https://github.com/sponsors/XadillaX"><img src="https://github.com/XadillaX/vscode-language-viml/raw/master/assets/github_sponsor_btn.png" /></a>
</p>

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=XadillaX.viml">
    <img src="https://vsmarketplacebadges.dev/version-short/XadillaX.viml.svg.?style=for-the-badge&colorA=FF7800&colorB=CC5600&label=VS%20MARKETPLACE" />
  </a>
  <a href="https://marketplace.visualstudio.com/items?itemName=XadillaX.viml">
    <img src="https://vsmarketplacebadges.dev/downloads-short/XadillaX.viml.svg.?style=for-the-badge&colorA=5DDB61&colorB=4BC74F&label=DOWNLOADS" />
  </a>
  <a href="https://marketplace.visualstudio.com/items?itemName=XadillaX.viml">
    <img src="https://vsmarketplacebadges.dev/rating-star/XadillaX.viml.svg.?style=for-the-badge&colorA=FBBD30&colorB=F2AA08" />
  </a>
<!-- ALL-CONTRIBUTORS-BADGE:START - Do not remove or modify this section -->
<a href="#contributors-"><img src="https://img.shields.io/badge/6-ALL%20CONTRIBUTORS?style=for-the-badge&colorA=FF69b4&colorB=cc47a4&label=ALL%20CONTRIBUTORS" /></a>
<!-- ALL-CONTRIBUTORS-BADGE:END -->
</p>

## What does this extension do?

[**VimL**](https://en.wikipedia.org/wiki/Vim_(text_editor)#Vim_script) (Also known as **Vim Language**, **VimScript**) support for [VSCode](https://code.visualstudio.com/).

Syntax Highlighting is synchronized from [Atom VimL](https://github.com/Alhadis/language-viml) with ❤ by [vscode-grammar-update-tool](https://github.com/XadillaX/vscode-update-grammar-tool).

Language Server Protocol depends on [vim-language-server](https://github.com/iamcco/vim-language-server).

> Thanks to [Alhadis/language-viml](https://github.com/Alhadis/language-viml), [iamcco/vim-language-server](https://github.com/iamcco/vim-language-server) and [XadillaX/vscode-update-grammar-tool](https://github.com/XadillaX/vscode-update-grammar-tool).

## Features

+ Language Server Protocol (Refer to [vim-language-server](https://github.com/iamcco/vim-language-server)):
  - Auto completion;
  - Function signature help;
  - Hover document;
  - Go to definition;
  - Go to references;
  - Document symbols;
  - Folding range;
  - Select range;
  - Rename;
  - Snippets;
  - Diagnostic;
+ Syntax highlighting for
  - **VimL files** (`*.vim`, `*.vimrc`, `_vimrc`, `*.gvimrc`, `*.ideavim`, `.ideavim`, `.ideavimrc`, `*.exrc`, etc);
  - **Vim Help files** (`*.txt` with matching a certain RegExp in file);
  - **Vim Snippet files** (`*.snip`, `*.snippet`, `*.snippets`, etc);
  - [**Vroom files**](https://github.com/google/vroom) (`*.vroom`);
+ Syntax highlighting for embedding **Vim related syntaxes** (see above) in **Markdown files**.

## Contributors ✨

Thanks goes to these wonderful people ([emoji key](https://allcontributors.org/docs/en/emoji-key)):

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tbody>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://xcoder.in/"><img src="https://avatars.githubusercontent.com/u/2842176?v=4?s=100" width="100px;" alt="Khaidi Chu"/><br /><sub><b>Khaidi Chu</b></sub></a><br /><a href="#maintenance-XadillaX" title="Maintenance">🚧</a> <a href="https://github.com/XadillaX/vscode-language-viml/commits?author=XadillaX" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/GitMensch"><img src="https://avatars.githubusercontent.com/u/6699539?v=4?s=100" width="100px;" alt="Simon Sobisch"/><br /><sub><b>Simon Sobisch</b></sub></a><br /><a href="#ideas-GitMensch" title="Ideas, Planning, & Feedback">🤔</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/dawsers"><img src="https://avatars.githubusercontent.com/u/47487972?v=4?s=100" width="100px;" alt="dawsers"/><br /><sub><b>dawsers</b></sub></a><br /><a href="https://github.com/XadillaX/vscode-language-viml/commits?author=dawsers" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/beastmatser"><img src="https://avatars.githubusercontent.com/u/79206232?v=4?s=100" width="100px;" alt="mrts"/><br /><sub><b>mrts</b></sub></a><br /><a href="https://github.com/XadillaX/vscode-language-viml/commits?author=beastmatser" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://stackoverflow.com/u/7881859"><img src="https://avatars.githubusercontent.com/u/28700378?v=4?s=100" width="100px;" alt="Wenfang Du"/><br /><sub><b>Wenfang Du</b></sub></a><br /><a href="https://github.com/XadillaX/vscode-language-viml/commits?author=wenfangdu" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="http://remcohaszing.nl"><img src="https://avatars.githubusercontent.com/u/779047?v=4?s=100" width="100px;" alt="Remco Haszing"/><br /><sub><b>Remco Haszing</b></sub></a><br /><a href="https://github.com/XadillaX/vscode-language-viml/commits?author=remcohaszing" title="Code">💻</a></td>
    </tr>
  </tbody>
</table>

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->

This project follows the [all-contributors](https://github.com/all-contributors/all-contributors) specification. Contributions of any kind welcome!
