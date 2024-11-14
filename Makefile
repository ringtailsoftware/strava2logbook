DOCKERIMG = strava2logbook 

all:
	DOCKER_BUILDKIT=1 docker build -t ${DOCKERIMG} .

nocache:
	DOCKER_BUILDKIT=1 docker build -t ${DOCKERIMG} . --no-cache

shell:
	docker run -ti --rm --rm -v ${PWD}:/data ${DOCKERIMG} /bin/bash


