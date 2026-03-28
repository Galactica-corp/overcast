SHELL:=/bin/bash
.EXPORT_ALL_VARIABLES:

package.json yarn.lock:
install node_modules: package.json yarn.lock
	yarn install

ifeq ($(CI),true)
o:=.ops
include $o/Makefile
endif
