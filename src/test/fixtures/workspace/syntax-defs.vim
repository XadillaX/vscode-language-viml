" Cross-file fixture (defs) for issue #69 v2 tests.
" Group definitions live here; references live in syntax-refs.vim.

syn match   xfileAlpha   /\a\+/
syn match   xfileAlphaNum /\w\+/
syn region  xfileBeta    start=/(/ end=/)/
syn cluster xfileGroup   contains=xfileAlpha,xfileBeta
