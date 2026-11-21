script
  statements[0]: select distinct=false groupAll=false
    items[0]: select-item
      expr: operator op="=="
        left: name
          parts[0]: ident name="a" quoted=false
        right: name
          parts[0]: ident name="b" quoted=false
    items[1]: select-item
      expr: operator op="->"
        left: name
          parts[0]: ident name="j" quoted=false
        right: string value="x" prefix=""
    items[2]: select-item
      expr: operator op="->>"
        left: name
          parts[0]: ident name="j" quoted=false
        right: string value="y" prefix=""
    items[3]: select-item
      expr: like op="GLOB" negated=false
        arg: name
          parts[0]: ident name="x" quoted=false
        pattern: string value="a*" prefix=""
    items[4]: select-item
      expr: like op="REGEXP" negated=false
        arg: name
          parts[0]: ident name="y" quoted=false
        pattern: string value="b" prefix=""
    items[5]: select-item
      expr: name
        parts[0]: ident name="quoted" quoted=true
    items[6]: select-item
      expr: name
        parts[0]: ident name="bracketed" quoted=true
    items[7]: select-item
      expr: name
        parts[0]: ident name="dq" quoted=true
    from[0]: table
      name: name
        parts[0]: ident name="t" quoted=false
  statements[1]: select distinct=false groupAll=false
    items[0]: select-item
      expr: param style="question" text="?"
    items[1]: select-item
      expr: param style="question" text="?1"
    items[2]: select-item
      expr: param style="colon-name" text=":name"
    items[3]: select-item
      expr: param style="at-name" text="@v"
    items[4]: select-item
      expr: param style="dollar-name" text="$x"
    from[0]: table
      name: name
        parts[0]: ident name="t" quoted=false
  statements[2]: insert byName=false
    table: name
      parts[0]: ident name="t" quoted=false
    source: values
      rows[0]: tuple
        items[0]: string value="ff" prefix="X"
        items[1]: number text="0x1F"
