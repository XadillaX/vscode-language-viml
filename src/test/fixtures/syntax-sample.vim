" Fixture syntax file for the issue #69 integration tests.
" Exercises group definitions, references, @clusters and line continuations.

syn match   vimlTestNumber   /\d\+/
syn match   vimlTestName     /\<\w\+\>/ contains=vimlTestNumber

syn region  vimlTestString
      \ start=/"/
      \ end=/"/
      \ contains=vimlTestNumber,vimlTestName

syn cluster vimlTestAll contains=vimlTestNumber,vimlTestName,vimlTestString

syn match   vimlTestTop /^.*$/ contains=@vimlTestAll nextgroup=vimlTestName
