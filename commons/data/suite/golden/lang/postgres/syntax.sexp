script
  statements[0]: select distinct=false groupAll=false
    items[0]: select-item
      expr: cast try=false
        arg: name
          parts[0]: ident name="a" quoted=false
        type: data-type name="INT"
    items[1]: select-item
      expr: cast try=false
        arg: name
          parts[0]: ident name="b" quoted=false
        type: data-type name="NUMERIC"
          args[0]: number text="10"
          args[1]: number text="2"
    items[2]: select-item
      expr: cast try=false
        arg: name
          parts[0]: ident name="c" quoted=false
        type: data-type name="TEXT[]"
    from[0]: table
      name: name
        parts[0]: ident name="t" quoted=false
  statements[1]: select distinct=false groupAll=false
    items[0]: select-item
      expr: like op="ILIKE" negated=false
        arg: name
          parts[0]: ident name="x" quoted=false
        pattern: string value="a%" prefix=""
    items[1]: select-item
      expr: like op="ILIKE" negated=true
        arg: name
          parts[0]: ident name="y" quoted=false
        pattern: string value="b%" prefix=""
  statements[2]: select distinct=false groupAll=false
    items[0]: select-item
      expr: operator op="->>"
        left: operator op="->"
          left: name
            parts[0]: ident name="d" quoted=false
          right: string value="k" prefix=""
        right: string value="v" prefix=""
    items[1]: select-item
      expr: operator op="#>"
        left: name
          parts[0]: ident name="d" quoted=false
        right: string value="{a,b}" prefix=""
    items[2]: select-item
      expr: operator op="@>"
        left: name
          parts[0]: ident name="d" quoted=false
        right: string value="{\"a\":1}" prefix=""
  statements[3]: select distinct=false groupAll=false
    items[0]: select-item
      expr: string value="a\nb" prefix="E"
    items[1]: select-item
      expr: string value="dollar 'quoted'" prefix=""
    items[2]: select-item
      expr: param style="dollar-number" text="$1"
    items[3]: select-item
      expr: number text="1_000"
  statements[4]: select distinct=false groupAll=false
    items[0]: select-item
      expr: binary op="*"
        left: operator op="^"
          left: number text="2"
          right: number text="3"
        right: number text="4"
    items[1]: select-item
      expr: operator op="~"
        left: name
          parts[0]: ident name="a" quoted=false
        right: string value="x" prefix=""
    items[2]: select-item
      expr: operator op="!~*"
        left: name
          parts[0]: ident name="b" quoted=false
        right: string value="y" prefix=""
  statements[5]: insert
    table: name
      parts[0]: ident name="t" quoted=false
    columns[0]: ident name="a" quoted=false
    source: values
      rows[0]: tuple
        items[0]: param style="dollar-number" text="$1"
    returning[0]: select-item
      expr: star
