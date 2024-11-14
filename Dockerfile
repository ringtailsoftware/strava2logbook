FROM ubuntu:20.04
ENV LANG C.UTF-8
ENV LC_ALL C.UTF-8
RUN apt-get -y update
RUN apt-get install -y wget git
WORKDIR /root
RUN DEBIAN_FRONTEND=noninteractive TZ=Etc/UTC apt-get -y install tzdata
RUN apt-get install -y perlmagick libtest-lwp-useragent-perl
RUN apt-get install -y pip python jq
RUN pip install yq
RUN curl -sL https://deb.nodesource.com/setup_20.x | bash -
RUN apt-get install -y nodejs npm
RUN apt-get install -y gpsbabel imagemagick

WORKDIR /data
CMD /bin/bash
