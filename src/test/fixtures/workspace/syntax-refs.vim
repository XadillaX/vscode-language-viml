" Cross-file fixture (refs) for issue #69 v2 tests.
" References groups defined in syntax-defs.vim, including an @cluster and a
" wildcard that should expand to xfileAlpha + xfileAlphaNum.

syn match   xfileConsumer /./
      \ contains=@xfileGroup,xfileAlpha.*
      \ nextgroup=xfileBeta
