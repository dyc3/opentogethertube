#!/bin/bash

# This is a script to easily send announcements to all currently connected clients.

USAGE="Usage: ./announce.sh -k APIKEY [-d HOST] MESSAGE"

if [ $# == 0 ] ; then
    echo $USAGE
    exit 1;
fi

HOST="localhost:3000"
APIKEY=""

while getopts ":i:vh" optname; do
    case "$optname" in
      "d")
        echo "-d argument: $OPTARG"
        HOST="$OPTARG"
        ;;
      "k")
        echo "-k argument: $OPTARG"
        APIKEY="$OPTARG"
        ;;
      "h")
        echo $USAGE
        exit 0;
        ;;
      "?")
        echo "Unknown option $OPTARG"
        exit 0;
        ;;
      ":")
        echo "No argument value for option $OPTARG"
        exit 0;
        ;;
      *)
        echo "Unknown error while processing options"
        exit 0;
        ;;
    esac
done
shift $(($OPTIND - 1))

if [[ -z "$NODE_ENV" ]]; then
    NODE_ENV="development"
fi

if [[ "$APIKEY" == "" ]]; then
    APIKEY=$(cat ./env/$NODE_ENV.env | grep OPENTOGETHERTUBE_API_KEY | cut -d = -f 2 | tr -d '[:space:]')
fi

MESSAGE=$1

curl -X POST -d apikey=$APIKEY\&text=$MESSAGE http://$HOST/api/announce
