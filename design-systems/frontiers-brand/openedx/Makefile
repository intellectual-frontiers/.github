.PHONY: build build-tokens build-scss dist clean
PARAGON ?= npx paragon
build: clean dist build-tokens build-scss
	cp *.svg *.png *.ico dist/
	cp -r paragon/images dist/paragon/
	cp -r paragon/fonts dist/fonts

dist:
	mkdir -p dist/paragon

build-tokens:
	$(PARAGON) build-tokens --source ./paragon/tokens/ --build-dir ./paragon/build -t light

build-scss: dist
	$(PARAGON) build-scss --corePath ./paragon/core.scss --themesPath ./paragon/build/themes --outDir ./dist

clean:
	rm -rf dist paragon/build
