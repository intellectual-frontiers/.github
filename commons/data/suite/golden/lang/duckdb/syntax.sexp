script
  statements[0]: select distinct=false
    items[0]: select-item
      expr: operator op="//"
        left: name
          parts[0]: ident name="a" quoted=false
        right: name
          parts[0]: ident name="b" quoted=false
    items[1]: select-item
      expr: operator op="**"
        left: number text="2"
        right: number text="3"
    items[2]: select-item
      expr: cast
        arg: name
          parts[0]: ident name="a" quoted=false
        type: data-type name="INT"
    items[3]: select-item
      expr: like op="ILIKE" negated=false
        arg: name
          parts[0]: ident name="x" quoted=false
        pattern: string value="a%" prefix=""
    items[4]: select-item
      expr: like op="GLOB" negated=false
        arg: name
          parts[0]: ident name="y" quoted=false
        pattern: string value="*.sql" prefix=""
    items[5]: select-item
      expr: operator op="->>"
        left: name
          parts[0]: ident name="d" quoted=false
        right: string value="k" prefix=""
    items[6]: select-item
      expr: param style="dollar-number" text="$1"
    items[7]: select-item
      expr: param style="dollar-name" text="$name"
    from[0]: table
      name: name
        parts[0]: ident name="t" quoted=false
  statements[1]: select distinct=false
    items[0]: select-item
      expr: call distinct=false
        name: name
          parts[0]: ident name="struct_pack" quoted=false
        args[0]: named-arg
          name: ident name="a" quoted=false
          value: number text="1"
        args[1]: named-arg
          name: ident name="b" quoted=false
          value: number text="2"
    from[0]: table-fn lateral=false
      call: call distinct=false
        name: name
          parts[0]: ident name="read_csv" quoted=false
        args[0]: string value="x.csv" prefix=""
        args[1]: named-arg
          name: ident name="header" quoted=false
          value: boolean value=true
      alias: alias
        name: ident name="r" quoted=false
