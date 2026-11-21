script
  statements[0]: insert
    table: name
      parts[0]: ident name="t" quoted=false
    source: values
      rows[0]: tuple
        items[0]: number text="1"
        items[1]: string value="a" prefix=""
  statements[1]: insert
    table: name
      parts[0]: ident name="s" quoted=false
      parts[1]: ident name="t" quoted=false
    columns[0]: name
      parts[0]: ident name="a" quoted=false
    columns[1]: name
      parts[0]: ident name="b" quoted=false
    source: values
      rows[0]: tuple
        items[0]: number text="1"
        items[1]: number text="2"
      rows[1]: tuple
        items[0]: number text="3"
        items[1]: number text="4"
    returning[0]: select-item
      expr: name
        parts[0]: ident name="a" quoted=false
    returning[1]: select-item
      expr: name
        parts[0]: ident name="b" quoted=false
      alias: ident name="bb" quoted=false
  statements[2]: insert
    table: name
      parts[0]: ident name="t" quoted=false
    columns[0]: name
      parts[0]: ident name="a" quoted=false
    source: select distinct=false groupAll=false
      items[0]: select-item
        expr: name
          parts[0]: ident name="a" quoted=false
      from[0]: table
        name: name
          parts[0]: ident name="u" quoted=false
  statements[3]: insert
    table: name
      parts[0]: ident name="t" quoted=false
  statements[4]: update
    table: table
      name: name
        parts[0]: ident name="t" quoted=false
    assignments[0]: assignment
      target: name
        parts[0]: ident name="a" quoted=false
      value: number text="1"
    assignments[1]: assignment
      target: name
        parts[0]: ident name="b" quoted=false
      value: binary op="+"
        left: name
          parts[0]: ident name="b" quoted=false
        right: number text="1"
    from[0]: table
      name: name
        parts[0]: ident name="u" quoted=false
    where: binary op="="
      left: name
        parts[0]: ident name="t" quoted=false
        parts[1]: ident name="id" quoted=false
      right: name
        parts[0]: ident name="u" quoted=false
        parts[1]: ident name="id" quoted=false
    returning[0]: select-item
      expr: name
        parts[0]: ident name="a" quoted=false
  statements[5]: update
    table: table
      name: name
        parts[0]: ident name="t" quoted=false
      alias: alias
        name: ident name="x" quoted=false
    assignments[0]: assignment
      target: name
        parts[0]: ident name="x" quoted=false
        parts[1]: ident name="a" quoted=false
      value: number text="2"
  statements[6]: delete
    table: table
      name: name
        parts[0]: ident name="t" quoted=false
    where: in-query negated=false
      arg: name
        parts[0]: ident name="a" quoted=false
      query: select distinct=false groupAll=false
        items[0]: select-item
          expr: name
            parts[0]: ident name="a" quoted=false
        from[0]: table
          name: name
            parts[0]: ident name="u" quoted=false
    returning[0]: select-item
      expr: star
  statements[7]: delete
    table: table
      name: name
        parts[0]: ident name="t" quoted=false
