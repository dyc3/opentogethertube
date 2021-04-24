#!/bin/sh

# original script: https://github.com/eficode/wait-for/blob/master/wait-for

TIMEOUT=15
QUIET=0

echoerr() {
  if [ "$QUIET" -ne 1 ]; then printf "%s\n" "$*" 1>&2; fi
}

usage() {
  exitcode="$1"
  cat << USAGE >&2
Usage:
  $cmdname host:port [-t timeout] [-- command args]
  -q | --quiet                        Do not output any status messages
  -t TIMEOUT | --timeout=timeout      Timeout in seconds, zero for no timeout
  -- COMMAND ARGS                     Execute command with args after the test finishes
USAGE
  exit "$exitcode"
}

wait_for_db() {
  for i in `seq $TIMEOUT` ; do
    nc -z "$WAIT_HOST_DB" "$WAIT_PORT_DB" > /dev/null 2>&1

    result=$?
    if [ $result -eq 0 ] ; then
      if [ $# -gt 0 ] ; then
        npx sequelize-cli db:migrate
        if [ $? != 0 ]; then
          echo "$0: Failed to run database migrations" >&2
          exit 2
        fi
        exec "$@"
      fi
      exit 0
    fi
    sleep 1
  done
  echo "$0: Operation timed out" >&2
  exit 1
}

while [ $# -gt 0 ]
do
  case "$1" in
    *:* )
    WAIT_HOST_DB=$(printf "%s\n" "$1"| cut -d : -f 1)
    WAIT_PORT_DB=$(printf "%s\n" "$1"| cut -d : -f 2)
    shift 1
    ;;
    -q | --quiet)
    QUIET=1
    shift 1
    ;;
    -t)
    TIMEOUT="$2"
    if [ "$TIMEOUT" = "" ]; then break; fi
    shift 2
    ;;
    --timeout=*)
    TIMEOUT="${1#*=}"
    shift 1
    ;;
    --)
    shift
    break
    ;;
    --help)
    usage 0
    ;;
    *)
    echoerr "Unknown argument: $1"
    usage 1
    ;;
  esac
done

if [ "$WAIT_HOST_DB" = "" -o "$WAIT_PORT_DB" = "" ]; then
  echoerr "Error: you need to provide a host and port to test."
  usage 2
fi

wait_for_db "$@"