#!/bin/sh
# AnyFS SSH helper, dialect posix, protocol 1.
#
# One command per run: sh helper.sh COMMAND ROOT [ARGUMENT...]. The bytes of an object go over standard input and standard output, never through an argument.
# Standard output and the exit status are the answer (see the specification 0002-anyfs-ssh-helper):
#   0 done | 10 missing | 11 conflict, with "found absent" or "found sha256:HEX" | 12 refused, with the reason | 13 locked | 14 too large | 20 failed | 22 no such root
# It uses only what a POSIX shell and the utilities of POSIX hold, and a tool for SHA-256 where there is one (sha256sum, shasum, openssl or sha256).
set -u
LC_ALL=C
export LC_ALL
umask 022

cmd=${1:-}
[ -n "$cmd" ] || { echo "no command" >&2; exit 20; }
shift
root=${1:-}
[ -n "$root" ] || { echo "no root" >&2; exit 20; }
shift

# ---------------------------------------------------------------- what the host has

hashtool=
if command -v sha256sum >/dev/null 2>&1; then hashtool=sha256sum
elif command -v shasum >/dev/null 2>&1; then hashtool=shasum
elif command -v openssl >/dev/null 2>&1; then hashtool=openssl
elif command -v sha256 >/dev/null 2>&1; then hashtool=sha256
fi

statkind=none
if stat -c %Y / >/dev/null 2>&1; then statkind=gnu
elif stat -f %m / >/dev/null 2>&1; then statkind=bsd
fi

# The SHA-256 of standard input, in hex.
hashstream() {
  case $hashtool in
    sha256sum) sha256sum | { read -r h _; printf '%s' "$h"; } ;;
    shasum) shasum -a 256 | { read -r h _; printf '%s' "$h"; } ;;
    openssl) openssl dgst -sha256 -r | { read -r h _; printf '%s' "$h"; } ;;
    sha256) sha256 -q ;;
    *) return 21 ;;
  esac
}
hashfile() { hashstream < "$1"; }
hashstring() { printf '%s' "$1" | hashstream; }

sizeof() { _n=$(wc -c < "$1"); printf '%s' $_n; }
mtimeof() {
  case $statkind in
    gnu) stat -c %Y -- "$1" ;;
    bsd) stat -f %m "$1" ;;
    *) printf '%s' - ;;
  esac
}

# ---------------------------------------------------------------- answers

say() { printf '%s\n' "$*"; }
refuse() { say "$1"; exit 12; }

# ---------------------------------------------------------------- the root

if [ "$cmd" = probe ]; then
  create=${1:-keep}
  if [ "$create" = create ]; then mkdir -p -- "$root" 2>/dev/null || exit 22; fi
fi
RR=$(cd -- "$root" 2>/dev/null && pwd -P) || exit 22
# a store at the root of the host's file system keeps its locks in the account's state folder, since a folder made at the root is not the account's to make
if [ "$RR" = / ]; then lockdir=${HOME:-/tmp}/.local/state/anyfs/locks-root; else lockdir=$RR/.anyfs-locks; fi
nl='
'

# A path of the store is below the root: segments of text, none empty, none "." or "..", none that begins with .anyfs- (the helper's own names), no line end.
checkpath() {
  case $1 in
    '') refuse shape ;;
    /*|*/|*//*|.|..|./*|*/.|*/./*|../*|*/..|*/../*) refuse shape ;;
    *"$nl"*) refuse shape ;;
    .anyfs-*|*/.anyfs-*) refuse hidden ;;
  esac
}

# Whether the deepest part of an absolute path that exists stays inside the root once every link on the way is followed; a link as the object itself is refused.
confine() {
  _d=$1
  while [ ! -e "$_d" ] && [ ! -L "$_d" ]; do
    _d=${_d%/*}
    [ -n "$_d" ] || _d=/
  done
  [ -L "$_d" ] && return 1
  if [ -d "$_d" ]; then _real=$(cd -- "$_d" 2>/dev/null && pwd -P) || return 1
  else
    _parent=${_d%/*}
    [ -n "$_parent" ] || _parent=/
    _real=$(cd -- "$_parent" 2>/dev/null && pwd -P) || return 1
  fi
  if [ "$RR" = / ]; then return 0; fi
  case $_real in "$RR"|"$RR"/*) return 0 ;; esac
  return 1
}

# ---------------------------------------------------------------- locks: a folder made by mkdir, which no file system makes twice

held1=
held2=
release() {
  [ -z "$held1" ] || rm -rf -- "$held1"
  [ -z "$held2" ] || rm -rf -- "$held2"
  held1=
  held2=
}
trap 'release' EXIT
trap 'release; exit 20' INT TERM HUP

# Takes the lock of a key; one that belongs to a process that is gone is taken over under a second lock, which is looked at again once it is held, so that a lock that is alive is never removed.
acquire() {
  mkdir -p -- "$lockdir" 2>/dev/null || return 1
  _l=$lockdir/$1.d
  _tries=0
  while :; do
    if mkdir "$_l" 2>/dev/null; then
      printf '%s\n' "$$" > "$_l/pid"
      if [ -z "$held1" ]; then held1=$_l; else held2=$_l; fi
      return 0
    fi
    _pid=$(cat "$_l/pid" 2>/dev/null)
    if [ -n "$_pid" ] && ! kill -0 "$_pid" 2>/dev/null; then
      if mkdir "$_l.take" 2>/dev/null; then
        _again=$(cat "$_l/pid" 2>/dev/null)
        if [ "$_again" = "$_pid" ]; then rm -rf -- "$_l"; fi
        rmdir "$_l.take" 2>/dev/null
        continue
      fi
    fi
    _tries=$((_tries + 1))
    [ "$_tries" -gt 600 ] && return 1
    sleep 0.05 2>/dev/null || sleep 1
  done
}
lockpath() { acquire "$(hashstring "$1")" || { say locked; exit 13; }; }

# ---------------------------------------------------------------- helpers

# The hash of the object at a path, or "absent".
revof() {
  if [ -f "$1" ] && [ ! -L "$1" ]; then printf 'sha256:%s' "$(hashfile "$1")"; else printf absent; fi
}

# What the expectation says about what is found: done where it holds, a conflict where it does not.
expect() {
  _expect=$1; _found=$2
  case $_expect in
    any) return 0 ;;
    absent) [ "$_found" = absent ] && return 0 ;;
    rev:*) [ "$_found" = "sha256:${_expect#rev:}" ] && return 0 ;;
    *) echo "an expectation of no known kind" >&2; exit 20 ;;
  esac
  say "found $_found"
  exit 11
}

newtmp() {
  _n=0
  while :; do
    _t=$1/.anyfs-tmp-$$-$_n
    if ( set -C; : > "$_t" ) 2>/dev/null; then printf '%s' "$_t"; return 0; fi
    _n=$((_n + 1))
    [ "$_n" -gt 100 ] && return 1
  done
}

# Takes away the folders a removal left empty, up to the root.
prune() {
  _p=${1%/*}
  while [ "$_p" != "$RR" ] && [ -n "$_p" ]; do
    case ${_p##*/} in .anyfs-*) return 0 ;; esac
    rmdir -- "$_p" 2>/dev/null || return 0
    _p=${_p%/*}
  done
}

# ---------------------------------------------------------------- commands

case $cmd in
  probe)
    say "protocol=1"
    say "dialect=posix"
    say "hash=${hashtool:-none}"
    say "stat=$statkind"
    _t=$RR/.anyfs-case-$$
    if ( set -C; : > "$_t" ) 2>/dev/null; then
      if [ -e "$RR/.ANYFS-CASE-$$" ]; then say "case=insensitive"; else say "case=sensitive"; fi
      rm -f -- "$_t"
    else
      say "case=unknown"
    fi
    ;;

  install)
    # standard input is this script; the first argument after the root is its hash, the second the folder to keep it in ("default": the state folder of the account)
    want=${1:-}
    dir=${2:-default}
    [ -n "$want" ] || { echo "install needs a hash" >&2; exit 20; }
    [ -n "$hashtool" ] || exit 21
    if [ "$dir" = default ]; then
      if [ -n "${XDG_STATE_HOME:-}" ]; then dir=$XDG_STATE_HOME/anyfs
      elif [ -n "${HOME:-}" ]; then dir=$HOME/.local/state/anyfs
      else echo "no home folder to keep the helper in" >&2; exit 20
      fi
    fi
    mkdir -p -- "$dir" || exit 20
    file=$dir/helper-$want.sh
    if [ -f "$file" ] && [ "$(hashfile "$file")" = "$want" ]; then printf '%s' "$file"; exit 0; fi
    tmp=$(newtmp "$dir") || exit 20
    cat > "$tmp" || { rm -f "$tmp"; exit 20; }
    got=$(hashfile "$tmp")
    if [ "$got" != "$want" ]; then rm -f "$tmp"; say "hash $got"; exit 30; fi
    chmod 500 "$tmp" && mv -f "$tmp" "$file" || { rm -f "$tmp"; exit 20; }
    printf '%s' "$file"
    ;;

  read)
    path=${1:-}; max=${2:-0}
    checkpath "$path"
    abs=$RR/$path
    confine "$abs" || refuse outside
    [ -f "$abs" ] || exit 10
    if [ "$max" -gt 0 ] && [ "$(sizeof "$abs")" -gt "$max" ]; then exit 14; fi
    cat "$abs" || exit 20
    ;;

  stat)
    path=${1:-}
    checkpath "$path"
    abs=$RR/$path
    confine "$abs" || refuse outside
    [ -f "$abs" ] || exit 10
    h=$(hashfile "$abs") || exit 21
    printf '%s\t%s\t%s\n' "$(sizeof "$abs")" "$(mtimeof "$abs")" "$h"
    ;;

  statmany)
    # standard input: one path on each line; one line of the answer for each that is an object: path, size, time, hash
    while IFS= read -r path; do
      case $path in '') continue ;; esac
      ( checkpath "$path" ) >/dev/null 2>&1 || continue
      abs=$RR/$path
      confine "$abs" || continue
      [ -f "$abs" ] || continue
      h=$(hashfile "$abs") || exit 21
      printf '%s\t%s\t%s\t%s\n' "$path" "$(sizeof "$abs")" "$(mtimeof "$abs")" "$h"
    done
    ;;

  list)
    prefix=${1:-}
    base=$RR
    if [ -n "$prefix" ]; then
      checkpath "$prefix"
      base=$RR/$prefix
      confine "$base" || refuse outside
      [ -d "$base" ] || exit 0
    fi
    find "$base" -name '.anyfs-*' -prune -o -type f -print | while IFS= read -r f; do printf '%s\n' "${f#"$RR"/}"; done
    ;;

  write)
    path=${1:-}; exp=${2:-any}; max=${3:-0}
    checkpath "$path"
    abs=$RR/$path
    dir=${abs%/*}
    confine "$abs" || refuse outside
    mkdir -p -- "$dir" 2>/dev/null || refuse notdir
    confine "$abs" || refuse outside
    [ -d "$abs" ] && refuse notfile
    tmp=$(newtmp "$dir") || exit 20
    trap 'rm -f -- "$tmp"; release' EXIT
    cat > "$tmp" || exit 20
    if [ "$max" -gt 0 ] && [ "$(sizeof "$tmp")" -gt "$max" ]; then exit 14; fi
    new=$(hashfile "$tmp") || exit 21
    case $exp in
      absent)
        if ln "$tmp" "$abs" 2>/dev/null; then say "created sha256:$new"; exit 0; fi
        say "found $(revof "$abs")"
        exit 11
        ;;
      rev:*)
        lockpath "$path"
        found=$(revof "$abs")
        expect "$exp" "$found"
        if [ "$found" = "sha256:$new" ]; then say "updated sha256:$new"; exit 0; fi
        mv -f -- "$tmp" "$abs" || exit 20
        say "updated sha256:$new"
        ;;
      any)
        had=0
        [ -f "$abs" ] && had=1
        mv -f -- "$tmp" "$abs" || exit 20
        if [ "$had" = 1 ]; then say "updated sha256:$new"; else say "created sha256:$new"; fi
        ;;
      *) echo "an expectation of no known kind" >&2; exit 20 ;;
    esac
    ;;

  delete)
    path=${1:-}; exp=${2:-any}
    checkpath "$path"
    abs=$RR/$path
    confine "$abs" || refuse outside
    case $exp in rev:*|absent) lockpath "$path" ;; esac
    found=$(revof "$abs")
    expect "$exp" "$found"
    if [ "$found" = absent ]; then say none; exit 0; fi
    rm -f -- "$abs" || exit 20
    prune "$abs"
    say existed
    ;;

  rename)
    from=${1:-}; to=${2:-}; exp=${3:-any}
    checkpath "$from"
    checkpath "$to"
    [ "$from" != "$to" ] || refuse same
    absfrom=$RR/$from
    absto=$RR/$to
    confine "$absfrom" || refuse outside
    confine "$absto" || refuse outside
    case $exp in rev:*|absent)
      first=$(printf '%s\n%s\n' "$from" "$to" | sort | head -n 1)
      if [ "$first" = "$from" ]; then lockpath "$from"; lockpath "$to"; else lockpath "$to"; lockpath "$from"; fi ;;
    esac
    found=$(revof "$absfrom")
    [ "$found" != absent ] || exit 10
    expect "$exp" "$found"
    mkdir -p -- "${absto%/*}" 2>/dev/null || refuse notdir
    confine "$absto" || refuse outside
    if ! ln "$absfrom" "$absto" 2>/dev/null; then say "found $(revof "$absto") at to"; exit 11; fi
    rm -f -- "$absfrom" || exit 20
    prune "$absfrom"
    say "moved $found"
    ;;

  *)
    echo "no such command: $cmd" >&2
    exit 20
    ;;
esac
