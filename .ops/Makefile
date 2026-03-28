chart:=oci://registry.fulgur.tech/library/chart
SHORT_SHA:=$(shell git rev-parse --short HEAD)
GIT_BRANCH:=$(shell git rev-parse --abbrev-ref HEAD | tr "!/.#%\t" '-' )
app:=overcast-mcp
NAMESPACE:=galactica
registry:=registry.fulgur.tech
repository=mcps/${app}
DOCKER_TAGS=${registry}/${repository}:${SHORT_SHA} \
	${registry}/${repository}:${GIT_BRANCH} \
	$(if $(filter main,${GIT_BRANCH}),${registry}/${repository}:latest)
DOCKER_FILE=$o/bridge-tx-mcp.Dockerfile
docker/build:
	docker build -f ${DOCKER_FILE} \
		$(foreach t,${DOCKER_TAGS},--tag $t) \
	.
docker/push:
	$(foreach t,${DOCKER_TAGS},docker push $t &&) echo pushed
	$(foreach t,${DOCKER_TAGS},docker rmi $t &&) echo cleaned
cd/docker: docker/build docker/push
cd: cd/docker helm/upgrade
gpg-keys:
	@echo ${SOPS_CI_KEY} | base64 -d | gpg --import
# .env: gpg-keys
# 	sops --extract '["SecretEnv"]' -d $o/values.sops.yaml | sed 's~: ~=~g' > $@

helm/upgrade: gpg-keys
	helm upgrade --install ${app} -n ${NAMESPACE} ${chart} \
		-f $o/values.yaml \
		-f <( sops -d $o/values.sops.yaml ) \
		--set commitSha=$(SHORT_SHA) \
		--wait --timeout=3m
