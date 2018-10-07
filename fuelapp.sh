#!/bin/sh
#/etc/init.d/myService
export PATH=$PATH:/usr/local/bin
export NODE_PATH=$NODE_PATH:/usr/local/lib/node_modules

case "$1" in
  start)
    exec forever --sourceDir=/home/pi/Fuel-App -p /home/pi/Fuel-App server.js  #scriptarguments
    ;;
  stop)
    exec forever stop --sourceDir=/home/pi/Fuel-App server.js
    ;;
  *)
  echo "Usage: /etc/init.d/Fuel-App {start|stop}"
  exit 1
  ;;
esac
exit 0