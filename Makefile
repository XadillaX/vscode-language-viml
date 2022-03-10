UPDATE_GRAMMAR_BIN = ./node_modules/.bin/update-grammar

.PHONY: update_grammar pack

update-grammar:
	$(UPDATE_GRAMMAR_BIN) Alhadis/language-viml grammars/viml.cson syntaxes/viml.tmLanguage.json
	$(UPDATE_GRAMMAR_BIN) Alhadis/language-viml grammars/help.cson syntaxes/help.tmLanguage.json
	$(UPDATE_GRAMMAR_BIN) Alhadis/language-viml grammars/snippet.cson syntaxes/snippet.tmLanguage.json

pack:
	npm install
	npm run compile
	rm -rf node_modules
	npm install --prod
