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
    if ! (which nc > /dev/null); then
      echo "$0: netcat not found."
      exit 3
    fi

    nc -z "$POSTGRES_HOST" "$POSTGRES_PORT" > /dev/null 2>&1

    result=$?
    if [ $result -eq 0 ] ; then
      if [ $# -gt 0 ] ; then
        if ! yarn workspace ott-server sequelize-cli db:migrate; then
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
    POSTGRES_HOST=$(printf "%s\n" "$1"| cut -d : -f 1)
    POSTGRES_PORT=$(printf "%s\n" "$1"| cut -d : -f 2)
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

# backwards compatibility
if [ "$POSTGRES_DB_HOST" != "" ]; then
  POSTGRES_HOST=$POSTGRES_DB_HOST
fi
if [ "$POSTGRES_DB_PORT" != "" ]; then
  POSTGRES_PORT=$POSTGRES_DB_PORT
fi

POSTGRES_HOST=${POSTGRES_HOST:-localhost}
POSTGRES_PORT=${POSTGRES_PORT:-5432}
if [ "$POSTGRES_HOST" = "" ] || [ "$POSTGRES_PORT" = "" ]; then
  echoerr "Error: you need to provide a host and port to test. Got: $POSTGRES_HOST:$POSTGRES_PORT"
  usage 2
fi

wait_for_db "$@"