#!/bin/bash

stop_port() {
  local port=$1
  local name=$2
  local pids
  pids=$(lsof -t -i ":$port" 2>/dev/null)
  if [ -n "$pids" ]; then
    kill $pids 2>/dev/null
    echo "Parado $name (puerto $port)"
  else
    echo "$name no estaba corriendo (puerto $port)"
  fi
}

case "$1" in
  app)
    stop_port 3000 "APP"
    ;;
  api)
    stop_port 3002 "API"
    ;;
  all|"")
    stop_port 3000 "APP"
    stop_port 3002 "API"
    ;;
  *)
    echo "Uso: ./stop.sh [all|api|app]"
    echo ""
    echo "  all  — Para APP y API (por defecto)"
    echo "  app  — Para la APP (:3000)"
    echo "  api  — Para el API (:3002)"
    ;;
esac
