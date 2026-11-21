script
  statements[0]: select distinct=true groupAll=false
    items[0]: select-item
      expr: name
        parts[0]: ident name="a" quoted=false
    items[1]: select-item
      expr: name
        parts[0]: ident name="b" quoted=false
      alias: ident name="c" quoted=false
    items[2]: select-item
      expr: name
        parts[0]: ident name="d" quoted=false
      alias: ident name="e" quoted=false
    from[0]: table
      name: name
        parts[0]: ident name="t" quoted=false
      alias: alias
        name: ident name="x" quoted=false
    from[1]: table
      name: name
        parts[0]: ident name="u" quoted=false
      alias: alias
        name: ident name="y" quoted=false
        columns[0]: ident name="p" quoted=false
        columns[1]: ident name="q" quoted=false
    where: binary op=">"
      left: name
        parts[0]: ident name="a" quoted=false
      right: number text="1"
    groupBy[0]: name
      parts[0]: ident name="a" quoted=false
    groupBy[1]: name
      parts[0]: ident name="b" quoted=false
    having: binary op=">"
      left: call distinct=false
        name: name
          parts[0]: ident name="count" quoted=false
        args[0]: star
      right: number text="1"
    orderBy[0]: order-item direction="desc"
      expr: name
        parts[0]: ident name="a" quoted=false
    orderBy[1]: order-item
      expr: name
        parts[0]: ident name="b" quoted=false
    limit: number text="10"
    offset: number text="5"
  statements[1]: select distinct=false groupAll=false
    items[0]: select-item
      expr: name
        parts[0]: ident name="a" quoted=false
    from[0]: join type="inner" natural=true
      left: join type="cross" natural=false
        left: join type="full" natural=false
          left: join type="right" natural=false
            left: join type="left" natural=false
              left: join type="inner" natural=false
                left: table
                  name: name
                    parts[0]: ident name="t1" quoted=false
                right: table
                  name: name
                    parts[0]: ident name="t2" quoted=false
                on: binary op="="
                  left: name
                    parts[0]: ident name="t1" quoted=false
                    parts[1]: ident name="id" quoted=false
                  right: name
                    parts[0]: ident name="t2" quoted=false
                    parts[1]: ident name="id" quoted=false
              right: table
                name: name
                  parts[0]: ident name="t3" quoted=false
              using[0]: ident name="id" quoted=false
            right: table
              name: name
                parts[0]: ident name="t4" quoted=false
            on: boolean value=true
          right: table
            name: name
              parts[0]: ident name="t5" quoted=false
          on: boolean value=true
        right: table
          name: name
            parts[0]: ident name="t6" quoted=false
      right: table
        name: name
          parts[0]: ident name="t7" quoted=false
  statements[2]: select distinct=false groupAll=false
    items[0]: select-item
      expr: star
    from[0]: subquery lateral=false
      query: select distinct=false groupAll=false
        items[0]: select-item
          expr: number text="1"
          alias: ident name="a" quoted=false
      alias: alias
        name: ident name="s" quoted=false
    from[1]: subquery lateral=true
      query: select distinct=false groupAll=false
        items[0]: select-item
          expr: name
            parts[0]: ident name="s" quoted=false
            parts[1]: ident name="a" quoted=false
      alias: alias
        name: ident name="l" quoted=false
    from[2]: table-fn lateral=false
      call: call distinct=false
        name: name
          parts[0]: ident name="generate_series" quoted=false
        args[0]: number text="1"
        args[1]: number text="3"
      alias: alias
        name: ident name="g" quoted=false
        columns[0]: ident name="n" quoted=false
  statements[3]: set-op op="except" quantifier="all"
    left: set-op op="union"
      left: select distinct=false groupAll=false
        items[0]: select-item
          expr: number text="1"
      right: set-op op="intersect"
        left: select distinct=false groupAll=false
          items[0]: select-item
            expr: number text="2"
        right: select distinct=false groupAll=false
          items[0]: select-item
            expr: number text="3"
    right: select distinct=false groupAll=false
      items[0]: select-item
        expr: number text="4"
  statements[4]: set-op op="union" quantifier="all"
    left: select distinct=false groupAll=false
      items[0]: select-item
        expr: number text="1"
    right: select distinct=false groupAll=false
      items[0]: select-item
        expr: number text="2"
    orderBy[0]: order-item
      expr: number text="1"
    limit: number text="5"
  statements[5]: set-op op="union"
    left: select distinct=false groupAll=false
      items[0]: select-item
        expr: number text="1"
      orderBy[0]: order-item
        expr: number text="1"
      limit: number text="1"
    right: select distinct=false groupAll=false
      items[0]: select-item
        expr: number text="2"
  statements[6]: with recursive=true
    ctes[0]: cte
      name: ident name="t" quoted=false
      columns[0]: ident name="n" quoted=false
      query: set-op op="union" quantifier="all"
        left: select distinct=false groupAll=false
          items[0]: select-item
            expr: number text="1"
        right: select distinct=false groupAll=false
          items[0]: select-item
            expr: binary op="+"
              left: name
                parts[0]: ident name="n" quoted=false
              right: number text="1"
          from[0]: table
            name: name
              parts[0]: ident name="t" quoted=false
          where: binary op="<"
            left: name
              parts[0]: ident name="n" quoted=false
            right: number text="5"
    body: select distinct=false groupAll=false
      items[0]: select-item
        expr: name
          parts[0]: ident name="n" quoted=false
      from[0]: table
        name: name
          parts[0]: ident name="t" quoted=false
  statements[7]: with recursive=false
    ctes[0]: cte
      name: ident name="a" quoted=false
      query: select distinct=false groupAll=false
        items[0]: select-item
          expr: number text="1"
    ctes[1]: cte
      name: ident name="b" quoted=false
      columns[0]: ident name="x" quoted=false
      columns[1]: ident name="y" quoted=false
      query: values
        rows[0]: tuple
          items[0]: number text="1"
          items[1]: number text="2"
    body: select distinct=false groupAll=false
      items[0]: select-item
        expr: star
      from[0]: table
        name: name
          parts[0]: ident name="a" quoted=false
      from[1]: table
        name: name
          parts[0]: ident name="b" quoted=false
  statements[8]: values
    rows[0]: tuple
      items[0]: number text="1"
      items[1]: string value="a" prefix=""
    rows[1]: tuple
      items[0]: number text="2"
      items[1]: string value="b" prefix=""
  statements[9]: select distinct=false groupAll=false
    items[0]: select-item
      expr: name
        parts[0]: ident name="a" quoted=false
    from[0]: table
      name: name
        parts[0]: ident name="t" quoted=false
    limit: number text="3"
  statements[10]: select distinct=false groupAll=false
    items[0]: select-item
      expr: name
        parts[0]: ident name="a" quoted=false
    from[0]: table
      name: name
        parts[0]: ident name="t" quoted=false
    limit: number text="5"
    offset: number text="2"
  statements[11]: select distinct=false groupAll=false
    items[0]: select-item
      expr: name
        parts[0]: ident name="t" quoted=false
        parts[1]: ident name="order" quoted=false
    items[1]: select-item
      expr: name
        parts[0]: ident name="t" quoted=false
        parts[1]: ident name="select" quoted=true
    from[0]: table
      name: name
        parts[0]: ident name="t" quoted=false
