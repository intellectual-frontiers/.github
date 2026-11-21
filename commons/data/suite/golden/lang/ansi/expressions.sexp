script
  statements[0]: select distinct=false groupAll=false
    items[0]: select-item
      expr: number text="1"
    items[1]: select-item
      expr: number text="2.5"
    items[2]: select-item
      expr: string value="it's" prefix=""
    items[3]: select-item
      expr: boolean value=true
    items[4]: select-item
      expr: boolean value=false
    items[5]: select-item
      expr: null
    items[6]: select-item
      expr: param style="question" text="?"
  statements[1]: select distinct=false groupAll=false
    items[0]: select-item
      expr: name
        parts[0]: ident name="a" quoted=false
        parts[1]: ident name="b" quoted=false
        parts[2]: ident name="c" quoted=false
    items[1]: select-item
      expr: name
        parts[0]: ident name="Quoted Name" quoted=true
    items[2]: select-item
      expr: star
        qualifier: name
          parts[0]: ident name="t" quoted=false
    items[3]: select-item
      expr: star
  statements[2]: select distinct=false groupAll=false
    items[0]: select-item
      expr: unary op="-"
        arg: name
          parts[0]: ident name="a" quoted=false
    items[1]: select-item
      expr: unary op="+"
        arg: name
          parts[0]: ident name="b" quoted=false
    items[2]: select-item
      expr: unary op="NOT"
        arg: name
          parts[0]: ident name="c" quoted=false
    items[3]: select-item
      expr: binary op="-"
        left: binary op="+"
          left: name
            parts[0]: ident name="a" quoted=false
          right: binary op="*"
            left: name
              parts[0]: ident name="b" quoted=false
            right: name
              parts[0]: ident name="c" quoted=false
        right: binary op="%"
          left: binary op="/"
            left: name
              parts[0]: ident name="d" quoted=false
            right: name
              parts[0]: ident name="e" quoted=false
          right: name
            parts[0]: ident name="f" quoted=false
    items[4]: select-item
      expr: binary op="||"
        left: binary op="||"
          left: name
            parts[0]: ident name="a" quoted=false
          right: name
            parts[0]: ident name="b" quoted=false
        right: name
          parts[0]: ident name="c" quoted=false
  statements[3]: select distinct=false groupAll=false
    items[0]: select-item
      expr: binary op="="
        left: name
          parts[0]: ident name="a" quoted=false
        right: number text="1"
    items[1]: select-item
      expr: binary op="<>"
        left: name
          parts[0]: ident name="a" quoted=false
        right: number text="2"
    items[2]: select-item
      expr: binary op="!="
        left: name
          parts[0]: ident name="a" quoted=false
        right: number text="3"
    items[3]: select-item
      expr: binary op="<"
        left: name
          parts[0]: ident name="a" quoted=false
        right: number text="4"
    items[4]: select-item
      expr: binary op="<="
        left: name
          parts[0]: ident name="a" quoted=false
        right: number text="5"
    items[5]: select-item
      expr: binary op=">"
        left: name
          parts[0]: ident name="a" quoted=false
        right: number text="6"
    items[6]: select-item
      expr: binary op=">="
        left: name
          parts[0]: ident name="a" quoted=false
        right: number text="7"
  statements[4]: select distinct=false groupAll=false
    items[0]: select-item
      expr: binary op="OR"
        left: binary op="AND"
          left: name
            parts[0]: ident name="a" quoted=false
          right: name
            parts[0]: ident name="b" quoted=false
        right: unary op="NOT"
          arg: name
            parts[0]: ident name="c" quoted=false
  statements[5]: select distinct=false groupAll=false
    items[0]: select-item
      expr: is test="null" negated=false
        arg: name
          parts[0]: ident name="a" quoted=false
    items[1]: select-item
      expr: is test="null" negated=true
        arg: name
          parts[0]: ident name="a" quoted=false
    items[2]: select-item
      expr: is test="true" negated=false
        arg: name
          parts[0]: ident name="a" quoted=false
    items[3]: select-item
      expr: is test="false" negated=true
        arg: name
          parts[0]: ident name="a" quoted=false
    items[4]: select-item
      expr: is test="unknown" negated=false
        arg: name
          parts[0]: ident name="a" quoted=false
    items[5]: select-item
      expr: is test="distinct-from" negated=false
        arg: name
          parts[0]: ident name="a" quoted=false
        other: name
          parts[0]: ident name="b" quoted=false
    items[6]: select-item
      expr: is test="distinct-from" negated=true
        arg: name
          parts[0]: ident name="a" quoted=false
        other: name
          parts[0]: ident name="b" quoted=false
  statements[6]: select distinct=false groupAll=false
    items[0]: select-item
      expr: between negated=false
        arg: name
          parts[0]: ident name="a" quoted=false
        low: number text="1"
        high: number text="2"
    items[1]: select-item
      expr: binary op="AND"
        left: between negated=true
          arg: name
            parts[0]: ident name="a" quoted=false
          low: number text="1"
          high: number text="2"
        right: name
          parts[0]: ident name="c" quoted=false
  statements[7]: select distinct=false groupAll=false
    items[0]: select-item
      expr: in negated=false bare=false
        arg: name
          parts[0]: ident name="a" quoted=false
        values[0]: number text="1"
        values[1]: number text="2"
        values[2]: number text="3"
    items[1]: select-item
      expr: in-query negated=true
        arg: name
          parts[0]: ident name="a" quoted=false
        query: select distinct=false groupAll=false
          items[0]: select-item
            expr: name
              parts[0]: ident name="x" quoted=false
          from[0]: table
            name: name
              parts[0]: ident name="t" quoted=false
    items[2]: select-item
      expr: in negated=false bare=false
        arg: name
          parts[0]: ident name="a" quoted=false
        values[0]: tuple
          items[0]: number text="1"
          items[1]: number text="2"
        values[1]: tuple
          items[0]: number text="3"
          items[1]: number text="4"
  statements[8]: select distinct=false groupAll=false
    items[0]: select-item
      expr: like op="LIKE" negated=false
        arg: name
          parts[0]: ident name="a" quoted=false
        pattern: string value="x%" prefix=""
    items[1]: select-item
      expr: like op="LIKE" negated=true
        arg: name
          parts[0]: ident name="a" quoted=false
        pattern: string value="x%" prefix=""
        escape: string value="!" prefix=""
  statements[9]: select distinct=false groupAll=false
    items[0]: select-item
      expr: case
        whens[0]: when
          cond: binary op=">"
            left: name
              parts[0]: ident name="a" quoted=false
            right: number text="1"
          result: string value="x" prefix=""
        whens[1]: when
          cond: binary op=">"
            left: name
              parts[0]: ident name="a" quoted=false
            right: number text="0"
          result: string value="y" prefix=""
        otherwise: string value="z" prefix=""
    items[1]: select-item
      expr: case
        operand: name
          parts[0]: ident name="a" quoted=false
        whens[0]: when
          cond: number text="1"
          result: string value="one" prefix=""
  statements[10]: select distinct=false groupAll=false
    items[0]: select-item
      expr: cast try=false
        arg: name
          parts[0]: ident name="a" quoted=false
        type: data-type name="INTEGER"
    items[1]: select-item
      expr: cast try=false
        arg: name
          parts[0]: ident name="b" quoted=false
        type: data-type name="DECIMAL"
          args[0]: number text="10"
          args[1]: number text="2"
    items[2]: select-item
      expr: cast try=false
        arg: name
          parts[0]: ident name="c" quoted=false
        type: data-type name="DOUBLE PRECISION"
    items[3]: select-item
      expr: cast try=false
        arg: name
          parts[0]: ident name="d" quoted=false
        type: data-type name="TIMESTAMP WITH TIME ZONE"
  statements[11]: select distinct=false groupAll=false
    items[0]: select-item
      expr: extract field="YEAR"
        arg: name
          parts[0]: ident name="d" quoted=false
    items[1]: select-item
      expr: interval unit="DAY"
        value: string value="1" prefix=""
    items[2]: select-item
      expr: interval
        value: string value="2" prefix=""
  statements[12]: select distinct=false groupAll=false
    items[0]: select-item
      expr: call distinct=false
        name: name
          parts[0]: ident name="count" quoted=false
        args[0]: star
    items[1]: select-item
      expr: call distinct=true
        name: name
          parts[0]: ident name="count" quoted=false
        args[0]: name
          parts[0]: ident name="a" quoted=false
    items[2]: select-item
      expr: call distinct=false
        name: name
          parts[0]: ident name="coalesce" quoted=false
        args[0]: name
          parts[0]: ident name="a" quoted=false
        args[1]: name
          parts[0]: ident name="b" quoted=false
        args[2]: number text="0"
    items[3]: select-item
      expr: call distinct=false
        name: name
          parts[0]: ident name="upper" quoted=false
        args[0]: name
          parts[0]: ident name="t" quoted=false
          parts[1]: ident name="name" quoted=false
  statements[13]: select distinct=false groupAll=false
    items[0]: select-item
      expr: call distinct=false
        name: name
          parts[0]: ident name="sum" quoted=false
        args[0]: name
          parts[0]: ident name="a" quoted=false
        filter: binary op=">"
          left: name
            parts[0]: ident name="a" quoted=false
          right: number text="0"
    items[1]: select-item
      expr: call distinct=false
        name: name
          parts[0]: ident name="row_number" quoted=false
        over: window-spec
          partitionBy[0]: name
            parts[0]: ident name="a" quoted=false
          orderBy[0]: order-item direction="desc" nulls="last"
            expr: name
              parts[0]: ident name="b" quoted=false
    items[2]: select-item
      expr: call distinct=false
        name: name
          parts[0]: ident name="sum" quoted=false
        args[0]: name
          parts[0]: ident name="x" quoted=false
        over: window-spec
          base: ident name="w" quoted=false
  statements[14]: select distinct=false groupAll=false
    items[0]: select-item
      expr: call distinct=false
        name: name
          parts[0]: ident name="sum" quoted=false
        args[0]: name
          parts[0]: ident name="x" quoted=false
        over: window-spec
          base: ident name="w" quoted=false
          frame: frame unit="rows"
            from: frame-bound type="preceding"
              offset: number text="1"
            to: frame-bound type="current-row"
    items[1]: select-item
      expr: call distinct=false
        name: name
          parts[0]: ident name="avg" quoted=false
        args[0]: name
          parts[0]: ident name="x" quoted=false
        over: window-spec
          orderBy[0]: order-item
            expr: name
              parts[0]: ident name="y" quoted=false
          frame: frame unit="range"
            from: frame-bound type="unbounded-preceding"
            to: frame-bound type="unbounded-following"
  statements[15]: select distinct=false groupAll=false
    items[0]: select-item
      expr: exists
        query: select distinct=false groupAll=false
          items[0]: select-item
            expr: number text="1"
    items[1]: select-item
      expr: unary op="NOT"
        arg: exists
          query: select distinct=false groupAll=false
            items[0]: select-item
              expr: number text="1"
    items[2]: select-item
      expr: scalar-query
        query: select distinct=false groupAll=false
          items[0]: select-item
            expr: call distinct=false
              name: name
                parts[0]: ident name="max" quoted=false
              args[0]: name
                parts[0]: ident name="a" quoted=false
          from[0]: table
            name: name
              parts[0]: ident name="t" quoted=false
    items[3]: select-item
      expr: tuple
        items[0]: number text="1"
        items[1]: number text="2"
