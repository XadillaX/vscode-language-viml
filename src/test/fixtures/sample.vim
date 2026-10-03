" Fixture Vim script used by the integration tests.
" Opening this file makes the extension start the VimL language client.
let s:greeting = 'hello'

function! Greet(name) abort
  echo s:greeting . ' ' . a:name
endfunction

call Greet('world')
