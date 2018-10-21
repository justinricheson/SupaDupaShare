FROM phusion/baseimage:0.9.14
MAINTAINER Oleg Golsosvskiy <ogolosovskiy@gmail.com>

# XXX: Workaround for https://github.com/docker/docker/issues/6345
RUN ln -s -f /bin/true /usr/bin/chfn

#base
RUN apt-get update && \
    DEBIAN_FRONTEND=noninteractive \
    apt-get install -y \
    	    apt-utils \
	    sudo \
            procps \
            --no-install-recommends

# coTurn + mongo driver pre req
RUN yes | apt-get install \
    	    build-essential \
	    automake \
	    autoconf \
	    libtool \
	    libssl-dev \
	    libevent-dev \
            libyajl-dev	 \
            libcurl4-openssl-dev \
	    git

# install coTurn
RUN cd ~ && \
    git clone https://github.com/coturn/coturn.git && \
    cd coturn && \
    git submodule init && \
    git submodule update && \
    ./configure && \
    make && \
    sudo make install && \
    mkdir -p /opt/coturn/etc && \
    mkdir -p /opt/coturn/var/log

# move config
ADD turnserver.conf /opt/coturn/etc/

RUN cd ~

# setup syslog-ng
# RUN cd ~ && \
#     apt-get install -y syslog-ng-core 

#RUN echo "SYSLOGNG_OPTS=\"--no-caps\"" >> /etc/default/syslog-ng
#ADD ./turn_log.conf /etc/syslog-ng/conf.d/
#RUN  sudo /usr/sbin/syslog-ng --no-caps

VOLUME /opt/coturn/ 

ENV MIN_PORT=60000
ENV MAX_PORT=65535

ADD turn.sh /root/turn.sh

EXPOSE 3478 3478/udp

# CMD ["/bin/bash", "-c", "service syslog-ng start &&  /usr/local/bin/turnserver -c /opt/coturn/etc/turnserver.conf"]

RUN chmod +x /root/turn.sh
CMD ["/bin/bash", "-c", "/root/turn.sh"]
