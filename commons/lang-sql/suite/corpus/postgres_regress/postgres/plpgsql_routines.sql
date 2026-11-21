create function tg_room_au() returns trigger as '
begin
    if new.roomno != old.roomno then
        update WSlot set roomno = new.roomno where roomno = old.roomno;
    end if;
    return new;
end;
' language plpgsql;

create function tg_room_ad() returns trigger as '
begin
    delete from WSlot where roomno = old.roomno;
    return old;
end;
' language plpgsql;

create function tg_wslot_biu() returns trigger as $$
begin
    if count(*) = 0 from Room where roomno = new.roomno then
        raise exception 'Room % does not exist', new.roomno;
    end if;
    return new;
end;
$$ language plpgsql;

create function tg_pfield_au() returns trigger as '
begin
    if new.name != old.name then
        update PSlot set pfname = new.name where pfname = old.name;
    end if;
    return new;
end;
' language plpgsql;

create function tg_pfield_ad() returns trigger as '
begin
    delete from PSlot where pfname = old.name;
    return old;
end;
' language plpgsql;

create function tg_pslot_biu() returns trigger as $proc$
declare
    pfrec	record;
    ps          alias for new;
begin
    select into pfrec * from PField where name = ps.pfname;
    if not found then
        raise exception $$Patchfield "%" does not exist$$, ps.pfname;
    end if;
    return ps;
end;
$proc$ language plpgsql;

create function tg_system_au() returns trigger as '
begin
    if new.name != old.name then
        update IFace set sysname = new.name where sysname = old.name;
    end if;
    return new;
end;
' language plpgsql;

create function tg_iface_biu() returns trigger as $$
declare
    sname	text;
    sysrec	record;
begin
    select into sysrec * from system where name = new.sysname;
    if not found then
        raise exception $q$system "%" does not exist$q$, new.sysname;
    end if;
    sname := 'IF.' || new.sysname;
    sname := sname || '.';
    sname := sname || new.ifname;
    if length(sname) > 20 then
        raise exception 'IFace slotname "%" too long (20 char max)', sname;
    end if;
    new.slotname := sname;
    return new;
end;
$$ language plpgsql;

create function tg_hub_a() returns trigger as '
declare
    hname	text;
    dummy	integer;
begin
    if tg_op = ''INSERT'' then
	dummy := tg_hub_adjustslots(new.name, 0, new.nslots);
	return new;
    end if;
    if tg_op = ''UPDATE'' then
	if new.name != old.name then
	    update HSlot set hubname = new.name where hubname = old.name;
	end if;
	dummy := tg_hub_adjustslots(new.name, old.nslots, new.nslots);
	return new;
    end if;
    if tg_op = ''DELETE'' then
	dummy := tg_hub_adjustslots(old.name, old.nslots, 0);
	return old;
    end if;
end;
' language plpgsql;

create function tg_hub_adjustslots(hname bpchar,
                                   oldnslots integer,
                                   newnslots integer)
returns integer as '
begin
    if newnslots = oldnslots then
        return 0;
    end if;
    if newnslots < oldnslots then
        delete from HSlot where hubname = hname and slotno > newnslots;
	return 0;
    end if;
    for i in oldnslots + 1 .. newnslots loop
        insert into HSlot (slotname, hubname, slotno, slotlink)
		values (''HS.dummy'', hname, i, '''');
    end loop;
    return 0;
end
' language plpgsql;

create function tg_hslot_biu() returns trigger as '
declare
    sname	text;
    xname	HSlot.slotname%TYPE;
    hubrec	record;
begin
    select into hubrec * from Hub where name = new.hubname;
    if not found then
        raise exception ''no manual manipulation of HSlot'';
    end if;
    if new.slotno < 1 or new.slotno > hubrec.nslots then
        raise exception ''no manual manipulation of HSlot'';
    end if;
    if tg_op = ''UPDATE'' and new.hubname != old.hubname then
	if count(*) > 0 from Hub where name = old.hubname then
	    raise exception ''no manual manipulation of HSlot'';
	end if;
    end if;
    sname := ''HS.'' || trim(new.hubname);
    sname := sname || ''.'';
    sname := sname || new.slotno::text;
    if length(sname) > 20 then
        raise exception ''HSlot slotname "%" too long (20 char max)'', sname;
    end if;
    new.slotname := sname;
    return new;
end;
' language plpgsql;

create function tg_hslot_bd() returns trigger as '
declare
    hubrec	record;
begin
    select into hubrec * from Hub where name = old.hubname;
    if not found then
        return old;
    end if;
    if old.slotno > hubrec.nslots then
        return old;
    end if;
    raise exception ''no manual manipulation of HSlot'';
end;
' language plpgsql;

create function tg_chkslotname() returns trigger as '
begin
    if substr(new.slotname, 1, 2) != tg_argv[0] then
        raise exception ''slotname must begin with %'', tg_argv[0];
    end if;
    return new;
end;
' language plpgsql;

create function tg_chkslotlink() returns trigger as '
begin
    if new.slotlink isnull then
        new.slotlink := '''';
    end if;
    return new;
end;
' language plpgsql;

create function tg_chkbacklink() returns trigger as '
begin
    if new.backlink isnull then
        new.backlink := '''';
    end if;
    return new;
end;
' language plpgsql;

create function tg_pslot_bu() returns trigger as '
begin
    if new.slotname != old.slotname then
        delete from PSlot where slotname = old.slotname;
	insert into PSlot (
		    slotname,
		    pfname,
		    slotlink,
		    backlink
		) values (
		    new.slotname,
		    new.pfname,
		    new.slotlink,
		    new.backlink
		);
        return null;
    end if;
    return new;
end;
' language plpgsql;

create function tg_wslot_bu() returns trigger as '
begin
    if new.slotname != old.slotname then
        delete from WSlot where slotname = old.slotname;
	insert into WSlot (
		    slotname,
		    roomno,
		    slotlink,
		    backlink
		) values (
		    new.slotname,
		    new.roomno,
		    new.slotlink,
		    new.backlink
		);
        return null;
    end if;
    return new;
end;
' language plpgsql;

create function tg_pline_bu() returns trigger as '
begin
    if new.slotname != old.slotname then
        delete from PLine where slotname = old.slotname;
	insert into PLine (
		    slotname,
		    phonenumber,
		    comment,
		    backlink
		) values (
		    new.slotname,
		    new.phonenumber,
		    new.comment,
		    new.backlink
		);
        return null;
    end if;
    return new;
end;
' language plpgsql;

create function tg_iface_bu() returns trigger as '
begin
    if new.slotname != old.slotname then
        delete from IFace where slotname = old.slotname;
	insert into IFace (
		    slotname,
		    sysname,
		    ifname,
		    slotlink
		) values (
		    new.slotname,
		    new.sysname,
		    new.ifname,
		    new.slotlink
		);
        return null;
    end if;
    return new;
end;
' language plpgsql;

create function tg_hslot_bu() returns trigger as '
begin
    if new.slotname != old.slotname or new.hubname != old.hubname then
        delete from HSlot where slotname = old.slotname;
	insert into HSlot (
		    slotname,
		    hubname,
		    slotno,
		    slotlink
		) values (
		    new.slotname,
		    new.hubname,
		    new.slotno,
		    new.slotlink
		);
        return null;
    end if;
    return new;
end;
' language plpgsql;

create function tg_phone_bu() returns trigger as '
begin
    if new.slotname != old.slotname then
        delete from PHone where slotname = old.slotname;
	insert into PHone (
		    slotname,
		    comment,
		    slotlink
		) values (
		    new.slotname,
		    new.comment,
		    new.slotlink
		);
        return null;
    end if;
    return new;
end;
' language plpgsql;

create function tg_backlink_a() returns trigger as '
declare
    dummy	integer;
begin
    if tg_op = ''INSERT'' then
        if new.backlink != '''' then
	    dummy := tg_backlink_set(new.backlink, new.slotname);
	end if;
	return new;
    end if;
    if tg_op = ''UPDATE'' then
        if new.backlink != old.backlink then
	    if old.backlink != '''' then
	        dummy := tg_backlink_unset(old.backlink, old.slotname);
	    end if;
	    if new.backlink != '''' then
	        dummy := tg_backlink_set(new.backlink, new.slotname);
	    end if;
	else
	    if new.slotname != old.slotname and new.backlink != '''' then
	        dummy := tg_slotlink_set(new.backlink, new.slotname);
	    end if;
	end if;
	return new;
    end if;
    if tg_op = ''DELETE'' then
        if old.backlink != '''' then
	    dummy := tg_backlink_unset(old.backlink, old.slotname);
	end if;
	return old;
    end if;
end;
' language plpgsql;

create function tg_backlink_set(myname bpchar, blname bpchar)
returns integer as '
declare
    mytype	char(2);
    link	char(4);
    rec		record;
begin
    mytype := substr(myname, 1, 2);
    link := mytype || substr(blname, 1, 2);
    if link = ''PLPL'' then
        raise exception
		''backlink between two phone lines does not make sense'';
    end if;
    if link in (''PLWS'', ''WSPL'') then
        raise exception
		''direct link of phone line to wall slot not permitted'';
    end if;
    if mytype = ''PS'' then
        select into rec * from PSlot where slotname = myname;
	if not found then
	    raise exception ''% does not exist'', myname;
	end if;
	if rec.backlink != blname then
	    update PSlot set backlink = blname where slotname = myname;
	end if;
	return 0;
    end if;
    if mytype = ''WS'' then
        select into rec * from WSlot where slotname = myname;
	if not found then
	    raise exception ''% does not exist'', myname;
	end if;
	if rec.backlink != blname then
	    update WSlot set backlink = blname where slotname = myname;
	end if;
	return 0;
    end if;
    if mytype = ''PL'' then
        select into rec * from PLine where slotname = myname;
	if not found then
	    raise exception ''% does not exist'', myname;
	end if;
	if rec.backlink != blname then
	    update PLine set backlink = blname where slotname = myname;
	end if;
	return 0;
    end if;
    raise exception ''illegal backlink beginning with %'', mytype;
end;
' language plpgsql;

create function tg_backlink_unset(bpchar, bpchar)
returns integer as '
declare
    myname	alias for $1;
    blname	alias for $2;
    mytype	char(2);
    rec		record;
begin
    mytype := substr(myname, 1, 2);
    if mytype = ''PS'' then
        select into rec * from PSlot where slotname = myname;
	if not found then
	    return 0;
	end if;
	if rec.backlink = blname then
	    update PSlot set backlink = '''' where slotname = myname;
	end if;
	return 0;
    end if;
    if mytype = ''WS'' then
        select into rec * from WSlot where slotname = myname;
	if not found then
	    return 0;
	end if;
	if rec.backlink = blname then
	    update WSlot set backlink = '''' where slotname = myname;
	end if;
	return 0;
    end if;
    if mytype = ''PL'' then
        select into rec * from PLine where slotname = myname;
	if not found then
	    return 0;
	end if;
	if rec.backlink = blname then
	    update PLine set backlink = '''' where slotname = myname;
	end if;
	return 0;
    end if;
end
' language plpgsql;

create function tg_slotlink_a() returns trigger as '
declare
    dummy	integer;
begin
    if tg_op = ''INSERT'' then
        if new.slotlink != '''' then
	    dummy := tg_slotlink_set(new.slotlink, new.slotname);
	end if;
	return new;
    end if;
    if tg_op = ''UPDATE'' then
        if new.slotlink != old.slotlink then
	    if old.slotlink != '''' then
	        dummy := tg_slotlink_unset(old.slotlink, old.slotname);
	    end if;
	    if new.slotlink != '''' then
	        dummy := tg_slotlink_set(new.slotlink, new.slotname);
	    end if;
	else
	    if new.slotname != old.slotname and new.slotlink != '''' then
	        dummy := tg_slotlink_set(new.slotlink, new.slotname);
	    end if;
	end if;
	return new;
    end if;
    if tg_op = ''DELETE'' then
        if old.slotlink != '''' then
	    dummy := tg_slotlink_unset(old.slotlink, old.slotname);
	end if;
	return old;
    end if;
end;
' language plpgsql;

create function tg_slotlink_set(bpchar, bpchar)
returns integer as '
declare
    myname	alias for $1;
    blname	alias for $2;
    mytype	char(2);
    link	char(4);
    rec		record;
begin
    mytype := substr(myname, 1, 2);
    link := mytype || substr(blname, 1, 2);
    if link = ''PHPH'' then
        raise exception
		''slotlink between two phones does not make sense'';
    end if;
    if link in (''PHHS'', ''HSPH'') then
        raise exception
		''link of phone to hub does not make sense'';
    end if;
    if link in (''PHIF'', ''IFPH'') then
        raise exception
		''link of phone to hub does not make sense'';
    end if;
    if link in (''PSWS'', ''WSPS'') then
        raise exception
		''slotlink from patchslot to wallslot not permitted'';
    end if;
    if mytype = ''PS'' then
        select into rec * from PSlot where slotname = myname;
	if not found then
	    raise exception ''% does not exist'', myname;
	end if;
	if rec.slotlink != blname then
	    update PSlot set slotlink = blname where slotname = myname;
	end if;
	return 0;
    end if;
    if mytype = ''WS'' then
        select into rec * from WSlot where slotname = myname;
	if not found then
	    raise exception ''% does not exist'', myname;
	end if;
	if rec.slotlink != blname then
	    update WSlot set slotlink = blname where slotname = myname;
	end if;
	return 0;
    end if;
    if mytype = ''IF'' then
        select into rec * from IFace where slotname = myname;
	if not found then
	    raise exception ''% does not exist'', myname;
	end if;
	if rec.slotlink != blname then
	    update IFace set slotlink = blname where slotname = myname;
	end if;
	return 0;
    end if;
    if mytype = ''HS'' then
        select into rec * from HSlot where slotname = myname;
	if not found then
	    raise exception ''% does not exist'', myname;
	end if;
	if rec.slotlink != blname then
	    update HSlot set slotlink = blname where slotname = myname;
	end if;
	return 0;
    end if;
    if mytype = ''PH'' then
        select into rec * from PHone where slotname = myname;
	if not found then
	    raise exception ''% does not exist'', myname;
	end if;
	if rec.slotlink != blname then
	    update PHone set slotlink = blname where slotname = myname;
	end if;
	return 0;
    end if;
    raise exception ''illegal slotlink beginning with %'', mytype;
end;
' language plpgsql;

create function tg_slotlink_unset(bpchar, bpchar)
returns integer as '
declare
    myname	alias for $1;
    blname	alias for $2;
    mytype	char(2);
    rec		record;
begin
    mytype := substr(myname, 1, 2);
    if mytype = ''PS'' then
        select into rec * from PSlot where slotname = myname;
	if not found then
	    return 0;
	end if;
	if rec.slotlink = blname then
	    update PSlot set slotlink = '''' where slotname = myname;
	end if;
	return 0;
    end if;
    if mytype = ''WS'' then
        select into rec * from WSlot where slotname = myname;
	if not found then
	    return 0;
	end if;
	if rec.slotlink = blname then
	    update WSlot set slotlink = '''' where slotname = myname;
	end if;
	return 0;
    end if;
    if mytype = ''IF'' then
        select into rec * from IFace where slotname = myname;
	if not found then
	    return 0;
	end if;
	if rec.slotlink = blname then
	    update IFace set slotlink = '''' where slotname = myname;
	end if;
	return 0;
    end if;
    if mytype = ''HS'' then
        select into rec * from HSlot where slotname = myname;
	if not found then
	    return 0;
	end if;
	if rec.slotlink = blname then
	    update HSlot set slotlink = '''' where slotname = myname;
	end if;
	return 0;
    end if;
    if mytype = ''PH'' then
        select into rec * from PHone where slotname = myname;
	if not found then
	    return 0;
	end if;
	if rec.slotlink = blname then
	    update PHone set slotlink = '''' where slotname = myname;
	end if;
	return 0;
    end if;
end;
' language plpgsql;

create function pslot_backlink_view(bpchar)
returns text as '
<<outer>>
declare
    rec		record;
    bltype	char(2);
    retval	text;
begin
    select into rec * from PSlot where slotname = $1;
    if not found then
        return '''';
    end if;
    if rec.backlink = '''' then
        return ''-'';
    end if;
    bltype := substr(rec.backlink, 1, 2);
    if bltype = ''PL'' then
        declare
	    rec		record;
	begin
	    select into rec * from PLine where slotname = "outer".rec.backlink;
	    retval := ''Phone line '' || trim(rec.phonenumber);
	    if rec.comment != '''' then
	        retval := retval || '' ('';
		retval := retval || rec.comment;
		retval := retval || '')'';
	    end if;
	    return retval;
	end;
    end if;
    if bltype = ''WS'' then
        select into rec * from WSlot where slotname = rec.backlink;
	retval := trim(rec.slotname) || '' in room '';
	retval := retval || trim(rec.roomno);
	retval := retval || '' -> '';
	return retval || wslot_slotlink_view(rec.slotname);
    end if;
    return rec.backlink;
end;
' language plpgsql;

create function pslot_slotlink_view(bpchar)
returns text as '
declare
    psrec	record;
    sltype	char(2);
    retval	text;
begin
    select into psrec * from PSlot where slotname = $1;
    if not found then
        return '''';
    end if;
    if psrec.slotlink = '''' then
        return ''-'';
    end if;
    sltype := substr(psrec.slotlink, 1, 2);
    if sltype = ''PS'' then
	retval := trim(psrec.slotlink) || '' -> '';
	return retval || pslot_backlink_view(psrec.slotlink);
    end if;
    if sltype = ''HS'' then
        retval := comment from Hub H, HSlot HS
			where HS.slotname = psrec.slotlink
			  and H.name = HS.hubname;
        retval := retval || '' slot '';
	retval := retval || slotno::text from HSlot
			where slotname = psrec.slotlink;
	return retval;
    end if;
    return psrec.slotlink;
end;
' language plpgsql;

create function wslot_slotlink_view(bpchar)
returns text as '
declare
    rec		record;
    sltype	char(2);
    retval	text;
begin
    select into rec * from WSlot where slotname = $1;
    if not found then
        return '''';
    end if;
    if rec.slotlink = '''' then
        return ''-'';
    end if;
    sltype := substr(rec.slotlink, 1, 2);
    if sltype = ''PH'' then
        select into rec * from PHone where slotname = rec.slotlink;
	retval := ''Phone '' || trim(rec.slotname);
	if rec.comment != '''' then
	    retval := retval || '' ('';
	    retval := retval || rec.comment;
	    retval := retval || '')'';
	end if;
	return retval;
    end if;
    if sltype = ''IF'' then
	declare
	    syrow	System%RowType;
	    ifrow	IFace%ROWTYPE;
        begin
	    select into ifrow * from IFace where slotname = rec.slotlink;
	    select into syrow * from System where name = ifrow.sysname;
	    retval := syrow.name || '' IF '';
	    retval := retval || ifrow.ifname;
	    if syrow.comment != '''' then
	        retval := retval || '' ('';
		retval := retval || syrow.comment;
		retval := retval || '')'';
	    end if;
	    return retval;
	end;
    end if;
    return rec.slotlink;
end;
' language plpgsql;

CREATE FUNCTION recursion_test(int,int) RETURNS text AS '
DECLARE rslt text;
BEGIN
    IF $1 <= 0 THEN
        rslt = CAST($2 AS TEXT);
    ELSE
        rslt = CAST($1 AS TEXT) || '','' || recursion_test($1 - 1, $2);
    END IF;
    RETURN rslt;
END;' LANGUAGE plpgsql;

create function test_found()
  returns boolean as '
  declare
  begin
  insert into found_test_tbl values (1);
  if FOUND then
     insert into found_test_tbl values (2);
  end if;

  update found_test_tbl set a = 100 where a = 1;
  if FOUND then
    insert into found_test_tbl values (3);
  end if;

  delete from found_test_tbl where a = 9999; -- matches no rows
  if not FOUND then
    insert into found_test_tbl values (4);
  end if;

  for i in 1 .. 10 loop
    -- no need to do anything
  end loop;
  if FOUND then
    insert into found_test_tbl values (5);
  end if;

  -- never executes the loop
  for i in 2 .. 1 loop
    -- no need to do anything
  end loop;
  if not FOUND then
    insert into found_test_tbl values (6);
  end if;
  return true;
  end;' language plpgsql;

create function test_table_func_rec() returns setof found_test_tbl as '
DECLARE
	rec RECORD;
BEGIN
	FOR rec IN select * from found_test_tbl LOOP
		RETURN NEXT rec;
	END LOOP;
	RETURN;
END;' language plpgsql;

create function test_table_func_row() returns setof found_test_tbl as '
DECLARE
	row found_test_tbl%ROWTYPE;
BEGIN
	FOR row IN select * from found_test_tbl LOOP
		RETURN NEXT row;
	END LOOP;
	RETURN;
END;' language plpgsql;

create function test_ret_set_scalar(int,int) returns setof int as '
DECLARE
	i int;
BEGIN
	FOR i IN $1 .. $2 LOOP
		RETURN NEXT i + 1;
	END LOOP;
	RETURN;
END;' language plpgsql;

create function test_ret_set_rec_dyn(int) returns setof record as '
DECLARE
	retval RECORD;
BEGIN
	IF $1 > 10 THEN
		SELECT INTO retval 5, 10, 15;
		RETURN NEXT retval;
		RETURN NEXT retval;
	ELSE
		SELECT INTO retval 50, 5::numeric, ''xxx''::text;
		RETURN NEXT retval;
		RETURN NEXT retval;
	END IF;
	RETURN;
END;' language plpgsql;

create function test_ret_rec_dyn(int) returns record as '
DECLARE
	retval RECORD;
BEGIN
	IF $1 > 10 THEN
		SELECT INTO retval 5, 10, 15;
		RETURN retval;
	ELSE
		SELECT INTO retval 50, 5::numeric, ''xxx''::text;
		RETURN retval;
	END IF;
END;' language plpgsql;

create function f1(x anyelement) returns anyelement as $$
begin
  return x + 1;
end$$ language plpgsql;

create function f1(x anyelement) returns anyarray as $$
begin
  return array[x + 1, x + 2];
end$$ language plpgsql;

create function f1(x anyarray) returns anyelement as $$
begin
  return x[1];
end$$ language plpgsql;

create function f1(x anyarray) returns anyarray as $$
begin
  return x;
end$$ language plpgsql;

create function f1(x anyelement) returns anyrange as $$
begin
  return array[x + 1, x + 2];
end$$ language plpgsql;

create function f1(x anyrange) returns anyarray as $$
begin
  return array[lower(x), upper(x)];
end$$ language plpgsql;

create function f1(x anycompatible, y anycompatible) returns anycompatiblearray as $$
begin
  return array[x, y];
end$$ language plpgsql;

create function f1(x anycompatiblerange, y anycompatible, z anycompatible) returns anycompatiblearray as $$
begin
  return array[lower(x), upper(x), y, z];
end$$ language plpgsql;

create function f1(x anycompatible) returns anycompatiblerange as $$
begin
  return array[x + 1, x + 2];
end$$ language plpgsql;

create function f1(x anycompatiblerange, y anycompatiblearray) returns anycompatiblerange as $$
begin
  return x;
end$$ language plpgsql;

create function f1(a anyelement, b anyarray,
                   c anycompatible, d anycompatible,
                   OUT x anyarray, OUT y anycompatiblearray)
as $$
begin
  x := a || b;
  y := array[c, d];
end$$ language plpgsql;

create function f1(in i int, out j int) returns int as $$
begin
  return i+1;
end$$ language plpgsql;

create function f1(in i int, out j int) as $$
begin
  j := i+1;
  return;
end$$ language plpgsql;

create or replace function f1(inout i int) as $$
begin
  i := i+1;
end$$ language plpgsql;

create function f1(in i int, out j int) returns setof int as $$
begin
  j := i+1;
  return next;
  j := i+2;
  return next;
  return;
end$$ language plpgsql;

create function f1(in i int, out j int, out k text) as $$
begin
  j := i;
  j := j+1;
  k := 'foo';
end$$ language plpgsql;

create function f1(in i int, out j int, out k text) returns setof record as $$
begin
  j := i+1;
  k := 'foo';
  return next;
  j := j+1;
  k := 'foot';
  return next;
end$$ language plpgsql;

create function duplic(in i anyelement, out j anyelement, out k anyarray) as $$
begin
  j := i;
  k := array[j,j];
  return;
end$$ language plpgsql;

create function duplic(in i anycompatiblerange, out j anycompatible, out k anycompatiblearray) as $$
begin
  j := lower(i);
  k := array[lower(i),upper(i)];
  return;
end$$ language plpgsql;

create function perform_simple_func(int) returns boolean as '
BEGIN
	IF $1 < 20 THEN
		INSERT INTO perform_test VALUES ($1, $1 + 10);
		RETURN TRUE;
	ELSE
		RETURN FALSE;
	END IF;
END;' language plpgsql;

create function perform_test_func() returns void as '
BEGIN
	IF FOUND then
		INSERT INTO perform_test VALUES (100, 100);
	END IF;

	PERFORM perform_simple_func(5);

	IF FOUND then
		INSERT INTO perform_test VALUES (100, 100);
	END IF;

	PERFORM perform_simple_func(50);

	IF FOUND then
		INSERT INTO perform_test VALUES (100, 100);
	END IF;

	RETURN;
END;' language plpgsql;

create function sp_id_user(a_login text) returns int as $$
declare x int;
begin
  select into x id from users where login = a_login;
  if found then return x; end if;
  return 0;
end$$ language plpgsql stable;

create function sp_add_user(a_login text) returns int as $$
declare my_id_user int;
begin
  my_id_user = sp_id_user( a_login );
  IF  my_id_user > 0 THEN
    RETURN -1;  -- error code for existing user
  END IF;
  INSERT INTO users ( login ) VALUES ( a_login );
  my_id_user = sp_id_user( a_login );
  IF  my_id_user = 0 THEN
    RETURN -2;  -- error code for insertion failure
  END IF;
  RETURN my_id_user;
end$$ language plpgsql;

create function use_refcursor(rc refcursor) returns int as $$
declare
    rc refcursor;
    x record;
begin
    rc := return_unnamed_refcursor();
    fetch next from rc into x;
    return x.a;
end
$$ language plpgsql;

create function return_refcursor(rc refcursor) returns refcursor as $$
begin
    open rc for select a from rc_test;
    return rc;
end
$$ language plpgsql;

create function refcursor_test1(refcursor) returns refcursor as $$
begin
    perform return_refcursor($1);
    return $1;
end
$$ language plpgsql;

create function refcursor_test2(int, int) returns boolean as $$
declare
    c1 cursor (param1 int, param2 int) for select * from rc_test where a > param1 and b > param2;
    nonsense record;
begin
    open c1($1, $2);
    fetch c1 into nonsense;
    close c1;
    if found then
        return true;
    else
        return false;
    end if;
end
$$ language plpgsql;

create function constant_refcursor() returns refcursor as $$
declare
    rc constant refcursor;
begin
    open rc for select a from rc_test;
    return rc;
end
$$ language plpgsql;

create or replace function constant_refcursor() returns refcursor as $$
declare
    rc constant refcursor := 'my_cursor_name';
begin
    open rc for select a from rc_test;
    return rc;
end
$$ language plpgsql;

create function namedparmcursor_test1(int, int) returns boolean as $$
declare
    c1 cursor (param1 int, param12 int) for select * from rc_test where a > param1 and b > param12;
    nonsense record;
begin
    open c1(param12 := $2, param1 := $1);
    fetch c1 into nonsense;
    close c1;
    if found then
        return true;
    else
        return false;
    end if;
end
$$ language plpgsql;

create function namedparmcursor_test2(int, int) returns boolean as $$
declare
    c1 cursor (param1 int, param2 int) for select * from rc_test where a > param1 and b > param2;
    nonsense record;
begin
    open c1(param1 := $1, $2);
    fetch c1 into nonsense;
    close c1;
    if found then
        return true;
    else
        return false;
    end if;
end
$$ language plpgsql;

create function namedparmcursor_test3() returns void as $$
declare
    c1 cursor (param1 int, param2 int) for select * from rc_test where a > param1 and b > param2;
begin
    open c1(param2 := 20, 21);
end
$$ language plpgsql;

create function namedparmcursor_test4() returns void as $$
declare
    c1 cursor (param1 int, param2 int) for select * from rc_test where a > param1 and b > param2;
begin
    open c1(20, param1 := 21);
end
$$ language plpgsql;

create function namedparmcursor_test5() returns void as $$
declare
  c1 cursor (p1 int, p2 int) for
    select * from tenk1 where thousand = p1 and tenthous = p2;
begin
  open c1 (p2 := 77, p2 := 42);
end
$$ language plpgsql;

create function namedparmcursor_test6() returns void as $$
declare
  c1 cursor (p1 int, p2 int) for
    select * from tenk1 where thousand = p1 and tenthous = p2;
begin
  open c1 (p2 := 77);
end
$$ language plpgsql;

create function namedparmcursor_test7() returns void as $$
declare
  c1 cursor (p1 int, p2 int) for
    select * from tenk1 where thousand = p1 and tenthous = p2;
begin
  open c1 (p2 := 77, p1 := 42/0);
end $$ language plpgsql;

create function namedparmcursor_test8() returns int4 as $$
declare
  c1 cursor (p1 int, p2 int) for
    select count(*) from tenk1 where thousand = p1 and tenthous = p2;
  n int4;
begin
  open c1 (77 -- test
  , 42);
  fetch c1 into n;
  return n;
end $$ language plpgsql;

create function namedparmcursor_test9(p1 int) returns int4 as $$
declare
  c1 cursor (p1 int, p2 int, debug int) for
    select count(*) from tenk1 where thousand = p1 and tenthous = p2
      and four = debug;
  p2 int4 := 1006;
  n int4;
begin
  -- use both supported syntaxes for named arguments
  open c1 (p1 := p1, p2 => p2, debug => 2);
  fetch c1 into n;
  return n;
end $$ language plpgsql;

create function raise_test1(int) returns int as $$
begin
    raise notice 'This message has too many parameters!', $1;
    return $1;
end;
$$ language plpgsql;

create function raise_test2(int) returns int as $$
begin
    raise notice 'This message has too few parameters: %, %, %', $1, $1;
    return $1;
end;
$$ language plpgsql;

create function raise_test3(int) returns int as $$
begin
    raise notice 'This message has no parameters (despite having %% signs in it)!';
    return $1;
end;
$$ language plpgsql;

CREATE FUNCTION reraise_test() RETURNS void AS $$
BEGIN
   BEGIN
       RAISE syntax_error;
   EXCEPTION
       WHEN syntax_error THEN
           BEGIN
               raise notice 'exception % thrown in inner block, reraising', sqlerrm;
               RAISE;
           EXCEPTION
               WHEN OTHERS THEN
                   raise notice 'RIGHT - exception % caught in inner block', sqlerrm;
           END;
   END;
EXCEPTION
   WHEN OTHERS THEN
       raise notice 'WRONG - exception % caught in outer block', sqlerrm;
END;
$$ LANGUAGE plpgsql;

create function bad_sql1() returns int as $$
declare a int;
begin
    a := 5;
    Johnny Yuma;
    a := 10;
    return a;
end$$ language plpgsql;

create function bad_sql2() returns int as $$
declare r record;
begin
    for r in select I fought the law, the law won LOOP
        raise notice 'in loop';
    end loop;
    return 5;
end;$$ language plpgsql;

create function missing_return_expr() returns int as $$
begin
    return ;
end;$$ language plpgsql;

create function void_return_expr() returns void as $$
begin
    return 5;
end;$$ language plpgsql;

create function void_return_expr() returns void as $$
begin
    perform 2+2;
end;$$ language plpgsql;

create function missing_return_expr() returns int as $$
begin
    perform 2+2;
end;$$ language plpgsql;

create or replace function execute_into_test(varchar) returns record as $$
declare
    _r record;
    _rt eifoo%rowtype;
    _v eitype;
    i int;
    j int;
    k int;
begin
    execute 'insert into '||$1||' values(10,15)';
    execute 'select (row).* from (select row(10,1)::eifoo) s' into _r;
    raise notice '% %', _r.i, _r.y;
    execute 'select * from '||$1||' limit 1' into _rt;
    raise notice '% %', _rt.i, _rt.y;
    execute 'select *, 20 from '||$1||' limit 1' into i, j, k;
    raise notice '% % %', i, j, k;
    execute 'select 1,2' into _v;
    return _v;
end; $$ language plpgsql;

create function excpt_test1() returns void as $$
begin
    raise notice '% %', sqlstate, sqlerrm;
end; $$ language plpgsql;

create function excpt_test2() returns void as $$
begin
    begin
        begin
            raise notice '% %', sqlstate, sqlerrm;
        end;
    end;
end; $$ language plpgsql;

create function excpt_test3() returns void as $$
begin
    begin
        raise exception 'user exception';
    exception when others then
	    raise notice 'caught exception % %', sqlstate, sqlerrm;
	    begin
	        raise notice '% %', sqlstate, sqlerrm;
	        perform 10/0;
        exception
            when substring_error then
                -- this exception handler shouldn't be invoked
                raise notice 'unexpected exception: % %', sqlstate, sqlerrm;
	        when division_by_zero then
	            raise notice 'caught exception % %', sqlstate, sqlerrm;
	    end;
	    raise notice '% %', sqlstate, sqlerrm;
    end;
end; $$ language plpgsql;

create function excpt_test4() returns text as $$
begin
	begin perform 1/0;
	exception when others then return sqlerrm; end;
end; $$ language plpgsql;

create function raise_exprs() returns void as $$
declare
    a integer[] = '{10,20,30}';
    c varchar = 'xyz';
    i integer;
begin
    i := 2;
    raise notice '%; %; %; %; %; %', a, a[i], c, (select c || 'abc'), row(10,'aaa',NULL,30), NULL;
end;$$ language plpgsql;

create function multi_datum_use(p1 int) returns bool as $$
declare
  x int;
  y int;
begin
  select into x,y unique1/p1, unique1/$1 from tenk1 group by unique1/p1;
  return x = y;
end$$ language plpgsql;

create or replace function stricttest() returns void as $$
declare x record;
begin
  -- should work
  insert into foo values(5,6) returning * into x;
  raise notice 'x.f1 = %, x.f2 = %', x.f1, x.f2;
end$$ language plpgsql;

create or replace function stricttest() returns void as $$
declare x record;
begin
  -- should fail due to implicit strict
  insert into foo values(7,8),(9,10) returning * into x;
  raise notice 'x.f1 = %, x.f2 = %', x.f1, x.f2;
end$$ language plpgsql;

create or replace function stricttest() returns void as $$
declare x record;
begin
  -- should work
  execute 'insert into foo values(5,6) returning *' into x;
  raise notice 'x.f1 = %, x.f2 = %', x.f1, x.f2;
end$$ language plpgsql;

create or replace function stricttest() returns void as $$
declare x record;
begin
  -- this should work since EXECUTE isn't as picky
  execute 'insert into foo values(7,8),(9,10) returning *' into x;
  raise notice 'x.f1 = %, x.f2 = %', x.f1, x.f2;
end$$ language plpgsql;

create or replace function stricttest() returns void as $$
declare x record;
begin
  -- should work
  select * from foo where f1 = 3 into strict x;
  raise notice 'x.f1 = %, x.f2 = %', x.f1, x.f2;
end$$ language plpgsql;

create or replace function stricttest() returns void as $$
declare x record;
begin
  -- should fail, no rows
  select * from foo where f1 = 0 into strict x;
  raise notice 'x.f1 = %, x.f2 = %', x.f1, x.f2;
end$$ language plpgsql;

create or replace function stricttest() returns void as $$
declare x record;
begin
  -- should fail, too many rows
  select * from foo where f1 > 3 into strict x;
  raise notice 'x.f1 = %, x.f2 = %', x.f1, x.f2;
end$$ language plpgsql;

create or replace function stricttest() returns void as $$
declare x record;
begin
  -- should work
  execute 'select * from foo where f1 = 3' into strict x;
  raise notice 'x.f1 = %, x.f2 = %', x.f1, x.f2;
end$$ language plpgsql;

create or replace function stricttest() returns void as $$
declare x record;
begin
  -- should fail, no rows
  execute 'select * from foo where f1 = 0' into strict x;
  raise notice 'x.f1 = %, x.f2 = %', x.f1, x.f2;
end$$ language plpgsql;

create or replace function stricttest() returns void as $$
declare x record;
begin
  -- should fail, too many rows
  execute 'select * from foo where f1 > 3' into strict x;
  raise notice 'x.f1 = %, x.f2 = %', x.f1, x.f2;
end$$ language plpgsql;

create or replace function stricttest() returns void as $$
declare
x record;
p1 int := 2;
p3 text := 'foo';
begin
  -- no rows
  select * from foo where f1 = p1 and f1::text = p3 into strict x;
  raise notice 'x.f1 = %, x.f2 = %', x.f1, x.f2;
end$$ language plpgsql;

create or replace function stricttest() returns void as $$
declare
x record;
p1 int := 2;
p3 text := $a$'Valame Dios!' dijo Sancho; 'no le dije yo a vuestra merced que mirase bien lo que hacia?'$a$;
begin
  -- no rows
  select * from foo where f1 = p1 and f1::text = p3 into strict x;
  raise notice 'x.f1 = %, x.f2 = %', x.f1, x.f2;
end$$ language plpgsql;

create or replace function stricttest() returns void as $$
declare
x record;
p1 int := 2;
p3 text := 'foo';
begin
  -- too many rows
  select * from foo where f1 > p1 or f1::text = p3  into strict x;
  raise notice 'x.f1 = %, x.f2 = %', x.f1, x.f2;
end$$ language plpgsql;

create or replace function stricttest() returns void as $$
declare x record;
begin
  -- too many rows, no params
  select * from foo where f1 > 3 into strict x;
  raise notice 'x.f1 = %, x.f2 = %', x.f1, x.f2;
end$$ language plpgsql;

create or replace function stricttest() returns void as $$
declare x record;
begin
  -- no rows
  execute 'select * from foo where f1 = $1 or f1::text = $2' using 0, 'foo' into strict x;
  raise notice 'x.f1 = %, x.f2 = %', x.f1, x.f2;
end$$ language plpgsql;

create or replace function stricttest() returns void as $$
declare x record;
begin
  -- too many rows
  execute 'select * from foo where f1 > $1' using 1 into strict x;
  raise notice 'x.f1 = %, x.f2 = %', x.f1, x.f2;
end$$ language plpgsql;

create or replace function stricttest() returns void as $$
declare x record;
begin
  -- too many rows, no parameters
  execute 'select * from foo where f1 > 3' into strict x;
  raise notice 'x.f1 = %, x.f2 = %', x.f1, x.f2;
end$$ language plpgsql;

create or replace function stricttest() returns void as $$
-- override the global
#print_strict_params off
declare
x record;
p1 int := 2;
p3 text := 'foo';
begin
  -- too many rows
  select * from foo where f1 > p1 or f1::text = p3  into strict x;
  raise notice 'x.f1 = %, x.f2 = %', x.f1, x.f2;
end$$ language plpgsql;

create or replace function stricttest() returns void as $$
-- override the global
#print_strict_params on
declare
x record;
p1 int := 2;
p3 text := 'foo';
begin
  -- too many rows
  select * from foo where f1 > p1 or f1::text = p3  into strict x;
  raise notice 'x.f1 = %, x.f2 = %', x.f1, x.f2;
end$$ language plpgsql;

create or replace function shadowtest(in1 int)
	returns table (out1 int) as $$
declare
in1 int;
out1 int;
begin
end
$$ language plpgsql;

create or replace function shadowtest()
	returns void as $$
declare
f1 int;
begin
	declare
	f1 int;
	begin
	end;
end$$ language plpgsql;

create or replace function shadowtest(in1 int)
	returns void as $$
declare
in1 int;
begin
	declare
	in1 int;
	begin
	end;
end$$ language plpgsql;

create or replace function shadowtest()
	returns void as $$
declare
f1 int;
c1 cursor (f1 int) for select 1;
begin
end$$ language plpgsql;

create or replace function shadowtest(f1 int)
	returns boolean as $$
declare f1 int; begin return 1; end $$ language plpgsql;

do $$
declare x int;
begin
  select v from generate_series(1,2) g(v) into x;
end;
$$;

do $$
declare x int;
begin
  execute 'select v from generate_series(1,2) g(v)' into x;
end;
$$;

do $$
declare
  x int;
  y int;
begin
  select 1 into x, y;
  select 1,2 into x, y;
  select 1,2,3 into x, y;
end
$$;

do $$
declare
  x int;
  y int;
begin
  select * from test_01 into x, y; -- should be ok
  raise notice 'ok';
  select * from test_01 into x;    -- should to fail
end;
$$;

do $$
declare
  t test_01;
begin
  select 1, 2 into t;  -- should be ok
  raise notice 'ok';
  select 1, 2, 3 into t; -- should fail;
end;
$$;

do $$
declare
  t test_01;
begin
  select 1 into t; -- should fail;
end;
$$;

create function sc_test() returns setof integer as $$
declare
  c scroll cursor for select f1 from int4_tbl;
  x integer;
begin
  open c;
  fetch last from c into x;
  while found loop
    return next x;
    fetch prior from c into x;
  end loop;
  close c;
end;
$$ language plpgsql;

create or replace function sc_test() returns setof integer as $$
declare
  c no scroll cursor for select f1 from int4_tbl;
  x integer;
begin
  open c;
  fetch last from c into x;
  while found loop
    return next x;
    fetch prior from c into x;
  end loop;
  close c;
end;
$$ language plpgsql;

create or replace function sc_test() returns setof integer as $$
declare
  c refcursor;
  x integer;
begin
  open c scroll for select f1 from int4_tbl;
  fetch last from c into x;
  while found loop
    return next x;
    fetch prior from c into x;
  end loop;
  close c;
end;
$$ language plpgsql;

create or replace function sc_test() returns setof integer as $$
declare
  c refcursor;
  x integer;
begin
  open c scroll for execute 'select f1 from int4_tbl';
  fetch last from c into x;
  while found loop
    return next x;
    fetch relative -2 from c into x;
  end loop;
  close c;
end;
$$ language plpgsql;

create or replace function sc_test() returns setof integer as $$
declare
  c refcursor;
  x integer;
begin
  open c scroll for execute 'select f1 from int4_tbl';
  fetch last from c into x;
  while found loop
    return next x;
    move backward 2 from c;
    fetch relative -1 from c into x;
  end loop;
  close c;
end;
$$ language plpgsql;

create or replace function sc_test() returns setof integer as $$
declare
  c cursor for select * from generate_series(1, 10);
  x integer;
begin
  open c;
  loop
      move relative 2 in c;
      if not found then
          exit;
      end if;
      fetch next from c into x;
      if found then
          return next x;
      end if;
  end loop;
  close c;
end;
$$ language plpgsql;

create or replace function sc_test() returns setof integer as $$
declare
  c cursor for select * from generate_series(1, 10);
  x integer;
begin
  open c;
  move forward all in c;
  fetch backward from c into x;
  if found then
    return next x;
  end if;
  close c;
end;
$$ language plpgsql;

create function pl_qual_names (param1 int) returns void as $$
<<outerblock>>
declare
  param1 int := 1;
begin
  <<innerblock>>
  declare
    param1 int := 2;
  begin
    raise notice 'param1 = %', param1;
    raise notice 'pl_qual_names.param1 = %', pl_qual_names.param1;
    raise notice 'outerblock.param1 = %', outerblock.param1;
    raise notice 'innerblock.param1 = %', innerblock.param1;
  end;
end;
$$ language plpgsql;

create function ret_query1(out int, out int) returns setof record as $$
begin
    $1 := -1;
    $2 := -2;
    return next;
    return query select x + 1, x * 10 from generate_series(0, 10) s (x);
    return next;
end;
$$ language plpgsql;

create or replace function ret_query2(lim int) returns setof record_type as $$
begin
    return query select fipshash(s.x::text), s.x, s.x > 0
                 from generate_series(-8, lim) s (x) where s.x % 2 = 0;
end;
$$ language plpgsql;

create function exc_using(int, text) returns int as $$
declare i int;
begin
  for i in execute 'select * from generate_series(1,$1)' using $1+1 loop
    raise notice '%', i;
  end loop;
  execute 'select $2 + $2*3 + length($1)' into i using $2,$1;
  return i;
end
$$ language plpgsql;

create or replace function exc_using(int) returns void as $$
declare
  c refcursor;
  i int;
begin
  open c for execute 'select * from generate_series(1,$1)' using $1+1;
  loop
    fetch c into i;
    exit when not found;
    raise notice '%', i;
  end loop;
  close c;
  return;
end;
$$ language plpgsql;

create or replace function forc01() returns void as $$
declare
  c cursor(r1 integer, r2 integer)
       for select * from generate_series(r1,r2) i;
  c2 cursor
       for select * from generate_series(41,43) i;
begin
  -- assign portal names to cursors to get stable output
  c := 'c';
  c2 := 'c2';
  for r in c(5,7) loop
    raise notice '% from %', r.i, c;
  end loop;
  -- again, to test if cursor was closed properly
  -- (and while we're at it, test named-parameter notation)
  for r in c(r2 := 10, r1 => 9) loop
    raise notice '% from %', r.i, c;
  end loop;
  -- and test a parameterless cursor
  for r in c2 loop
    raise notice '% from %', r.i, c2;
  end loop;
  -- and try it with a hand-assigned name
  raise notice 'after loop, c2 = %', c2;
  c2 := 'special_name';
  for r in c2 loop
    raise notice '% from %', r.i, c2;
  end loop;
  raise notice 'after loop, c2 = %', c2;
  -- and try it with a generated name
  -- (which we can't show in the output because it's variable)
  c2 := null;
  for r in c2 loop
    raise notice '%', r.i;
  end loop;
  raise notice 'after loop, c2 = %', c2;
  return;
end;
$$ language plpgsql;

create or replace function forc01() returns void as $$
declare
  c cursor for select * from forc_test;
begin
  for r in c loop
    raise notice '%, %', r.i, r.j;
    update forc_test set i = i * 100, j = r.j * 2 where current of c;
  end loop;
end;
$$ language plpgsql;

create or replace function forc01() returns void as $$
declare
  c refcursor := 'fooled_ya';
  r record;
begin
  open c for select * from forc_test;
  loop
    fetch c into r;
    exit when not found;
    raise notice '%, %', r.i, r.j;
    update forc_test set i = i * 100, j = r.j * 2 where current of c;
  end loop;
end;
$$ language plpgsql;

do $$
declare cnt int := 0;
  c1 cursor for select * from forc_test;
begin
  for r1 in c1 loop
    declare c1 cursor for select * from forc_test;
    begin
      for r2 in c1 loop
        cnt := cnt + 1;
      end loop;
    end;
  end loop;
  raise notice 'cnt = %', cnt;
end $$;

create or replace function forc_bad() returns void as $$
declare
  c refcursor;
begin
  for r in c loop
    raise notice '%', r.i;
  end loop;
end;
$$ language plpgsql;

create or replace function return_dquery()
returns setof int as $$
begin
  return query execute 'select * from (values(10),(20)) f';
  return query execute 'select * from (values($1),($2)) f' using 40,50;
end;
$$ language plpgsql;

create or replace function returnqueryf()
returns setof tabwithcols as $$
begin
  return query select * from tabwithcols;
  return query execute 'select * from tabwithcols';
end;
$$ language plpgsql;

create or replace function compos() returns compostype as $$
declare
  v compostype;
begin
  v := (1, 'hello');
  return v;
end;
$$ language plpgsql;

create or replace function compos() returns compostype as $$
declare
  v record;
begin
  v := (1, 'hello'::varchar);
  return v;
end;
$$ language plpgsql;

create or replace function compos() returns compostype as $$
begin
  return (1, 'hello'::varchar);
end;
$$ language plpgsql;

create or replace function compos() returns compostype as $$
begin
  return (1, 'hello');
end;
$$ language plpgsql;

create or replace function compos() returns compostype as $$
begin
  return (1, 'hello')::compostype;
end;
$$ language plpgsql;

create or replace function composrec() returns record as $$
declare
  v record;
begin
  v := (1, 'hello');
  return v;
end;
$$ language plpgsql;

create or replace function composrec() returns record as $$
begin
  return (1, 'hello');
end;
$$ language plpgsql;

create or replace function compos() returns setof compostype as $$
begin
  for i in 1..3
  loop
    return next (1, 'hello'::varchar);
  end loop;
  return next null::compostype;
  return next (2, 'goodbye')::compostype;
end;
$$ language plpgsql;

create or replace function compos() returns compostype as $$
begin
  return 1 + 1;
end;
$$ language plpgsql;

create or replace function compos() returns compostype as $$
declare x int := 42;
begin
  return x;
end;
$$ language plpgsql;

create or replace function compos() returns int as $$
declare
  v compostype;
begin
  v := (1, 'hello');
  return v;
end;
$$ language plpgsql;

create or replace function compos() returns int as $$
begin
  return (1, 'hello')::compostype;
end;
$$ language plpgsql;

create or replace function raise_test() returns void as $$
begin
  raise notice '% % %', 1, 2, 3
     using errcode = '55001', detail = 'some detail info', hint = 'some hint';
  raise '% % %', 1, 2, 3
     using errcode = 'division_by_zero', detail = 'some detail info';
end;
$$ language plpgsql;

create or replace function raise_test() returns void as $$
begin
  raise 'check me'
     using errcode = 'division_by_zero', detail = 'some detail info';
  exception
    when others then
      raise notice 'SQLSTATE: % SQLERRM: %', sqlstate, sqlerrm;
      raise;
end;
$$ language plpgsql;

create or replace function raise_test() returns void as $$
begin
  raise 'check me'
     using errcode = '1234F', detail = 'some detail info';
  exception
    when others then
      raise notice 'SQLSTATE: % SQLERRM: %', sqlstate, sqlerrm;
      raise;
end;
$$ language plpgsql;

create or replace function raise_test() returns void as $$
begin
  raise 'check me'
     using errcode = '1234F', detail = 'some detail info';
  exception
    when sqlstate '1234F' then
      raise notice 'SQLSTATE: % SQLERRM: %', sqlstate, sqlerrm;
      raise;
end;
$$ language plpgsql;

create or replace function raise_test() returns void as $$
begin
  raise division_by_zero using detail = 'some detail info';
  exception
    when others then
      raise notice 'SQLSTATE: % SQLERRM: %', sqlstate, sqlerrm;
      raise;
end;
$$ language plpgsql;

create or replace function raise_test() returns void as $$
begin
  raise division_by_zero;
end;
$$ language plpgsql;

create or replace function raise_test() returns void as $$
begin
  raise sqlstate '1234F';
end;
$$ language plpgsql;

create or replace function raise_test() returns void as $$
begin
  raise division_by_zero using message = 'custom' || ' message';
end;
$$ language plpgsql;

create or replace function raise_test() returns void as $$
begin
  raise using message = 'custom' || ' message', errcode = '22012';
end;
$$ language plpgsql;

create or replace function raise_test() returns void as $$
begin
  raise notice 'some message' using message = 'custom' || ' message', errcode = '22012';
end;
$$ language plpgsql;

create or replace function raise_test() returns void as $$
begin
  raise division_by_zero using message = 'custom' || ' message', errcode = '22012';
end;
$$ language plpgsql;

create or replace function raise_test() returns void as $$
begin
  raise;
end;
$$ language plpgsql;

create function zero_divide() returns int as $$
declare v int := 0;
begin
  return 10 / v;
end;
$$ language plpgsql parallel safe;

create or replace function raise_test() returns void as $$
begin
  raise exception 'custom exception'
     using detail = 'some detail of custom exception',
           hint = 'some hint related to custom exception';
end;
$$ language plpgsql;

create function stacked_diagnostics_test() returns void as $$
declare _sqlstate text;
        _message text;
        _context text;
begin
  perform zero_divide();
exception when others then
  get stacked diagnostics
        _sqlstate = returned_sqlstate,
        _message = message_text,
        _context = pg_exception_context;
  raise notice 'sqlstate: %, message: %, context: [%]',
    _sqlstate, _message, replace(_context, E'\n', ' <- ');
end;
$$ language plpgsql;

create or replace function stacked_diagnostics_test() returns void as $$
declare _detail text;
        _hint text;
        _message text;
begin
  perform raise_test();
exception when others then
  get stacked diagnostics
        _message = message_text,
        _detail = pg_exception_detail,
        _hint = pg_exception_hint;
  raise notice 'message: %, detail: %, hint: %', _message, _detail, _hint;
end;
$$ language plpgsql;

create or replace function stacked_diagnostics_test() returns void as $$
declare _detail text;
        _hint text;
        _message text;
begin
  get stacked diagnostics
        _message = message_text,
        _detail = pg_exception_detail,
        _hint = pg_exception_hint;
  raise notice 'message: %, detail: %, hint: %', _message, _detail, _hint;
end;
$$ language plpgsql;

create function error_trap_test() returns text as $$
begin
  perform zero_divide();
  return 'no error detected!';
exception when division_by_zero then
  return 'division_by_zero detected';
end;
$$ language plpgsql parallel safe;

create or replace function raise_test() returns void as $$
begin
  perform 1/0;
exception
  when sqlstate '22012' then
    raise notice using message = sqlstate;
    raise sqlstate '22012' using message = 'substitute message';
end;
$$ language plpgsql;

create or replace function stacked_diagnostics_test() returns void as $$
declare _column_name text;
        _constraint_name text;
        _datatype_name text;
        _table_name text;
        _schema_name text;
begin
  raise exception using
    column = '>>some column name<<',
    constraint = '>>some constraint name<<',
    datatype = '>>some datatype name<<',
    table = '>>some table name<<',
    schema = '>>some schema name<<';
exception when others then
  get stacked diagnostics
        _column_name = column_name,
        _constraint_name = constraint_name,
        _datatype_name = pg_datatype_name,
        _table_name = table_name,
        _schema_name = schema_name;
  raise notice 'column %, constraint %, type %, table %, schema %',
    _column_name, _constraint_name, _datatype_name, _table_name, _schema_name;
end;
$$ language plpgsql;

create or replace function vari(variadic int[])
returns void as $$
begin
  for i in array_lower($1,1)..array_upper($1,1) loop
    raise notice '%', $1[i];
  end loop; end;
$$ language plpgsql;

create or replace function pleast(variadic numeric[])
returns numeric as $$
declare aux numeric = $1[array_lower($1,1)];
begin
  for i in array_lower($1,1)+1..array_upper($1,1) loop
    if $1[i] < aux then aux := $1[i]; end if;
  end loop;
  return aux;
end;
$$ language plpgsql immutable strict;

create or replace function pleast(numeric)
returns numeric as $$
begin
  raise notice 'non-variadic function called';
  return $1;
end;
$$ language plpgsql immutable strict;

create function tftest(int) returns table(a int, b int) as $$
begin
  return query select $1, $1+i from generate_series(1,5) g(i);
end;
$$ language plpgsql immutable strict;

create or replace function tftest(a1 int) returns table(a int, b int) as $$
begin
  a := a1; b := a1 + 1;
  return next;
  a := a1 * 10; b := a1 * 10 + 1;
  return next;
end;
$$ language plpgsql immutable strict;

create function rttest()
returns setof int as $$
declare rc int;
begin
  return query values(10),(20);
  get diagnostics rc = row_count;
  raise notice '% %', found, rc;
  return query select * from (values(10),(20)) f(a) where false;
  get diagnostics rc = row_count;
  raise notice '% %', found, rc;
  return query execute 'values(10),(20)';
  get diagnostics rc = row_count;
  raise notice '% %', found, rc;
  return query execute 'select * from (values(10),(20)) f(a) where false';
  get diagnostics rc = row_count;
  raise notice '% %', found, rc;
end;
$$ language plpgsql;

create or replace function rttest()
returns setof int as $$
begin
  return query select 10 into no_such_table;
end;
$$ language plpgsql;

create or replace function rttest()
returns setof int as $$
begin
  return query execute 'select 10 into no_such_table';
end;
$$ language plpgsql;

CREATE FUNCTION leaker_1(fail BOOL) RETURNS INTEGER AS $$
DECLARE
  v_var INTEGER;
BEGIN
  BEGIN
    v_var := (leaker_2(fail)).error_code;
  EXCEPTION
    WHEN others THEN RETURN 0;
  END;
  RETURN 1;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION leaker_2(fail BOOL, OUT error_code INTEGER, OUT new_id INTEGER)
  RETURNS RECORD AS $$
BEGIN
  IF fail THEN
    RAISE EXCEPTION 'fail ...';
  END IF;
  error_code := 1;
  new_id := 1;
  RETURN;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION nonsimple_expr_test() RETURNS text[] AS $$
DECLARE
  arr text[];
  lr text;
  i integer;
BEGIN
  arr := array[array['foo','bar'], array['baz', 'quux']];
  lr := 'fool';
  i := 1;
  -- use sub-SELECTs to make expressions non-simple
  arr[(SELECT i)][(SELECT i+1)] := (SELECT lr);
  RETURN arr;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION nonsimple_expr_test() RETURNS integer AS $$
declare
   i integer NOT NULL := 0;
begin
  begin
    i := (SELECT NULL::integer);  -- should throw error
  exception
    WHEN OTHERS THEN
      i := (SELECT 1::integer);
  end;
  return i;
end;
$$ LANGUAGE plpgsql;

create function recurse(float8) returns float8 as
$$
begin
  if ($1 > 0) then
    return sql_recurse($1 - 1);
  else
    return $1;
  end if;
end;
$$ language plpgsql;

create function sql_recurse(float8) returns float8 as
$$ select recurse($1) limit 1; $$ language sql;

create function error1(text) returns text language sql as
$$ SELECT relname::text FROM pg_class c WHERE c.oid = $1::regclass $$;

create function error2(p_name_table text) returns text language plpgsql as $$
begin
  return error1(p_name_table);
end$$;

create function sql_to_date(integer) returns date as $$
select $1::text::date
$$ language sql immutable strict;

create function cast_invoker(integer) returns date as $$
begin
  return $1;
end$$ language plpgsql;

do $$ declare x text[]; begin x := '{1.23, 4.56}'::numeric[]; end $$;

create function fail() returns int language plpgsql as $$
begin
  return 1/0;
end
$$;

create or replace function strtest() returns text as $$
begin
  raise notice 'foo\\bar\041baz\';
  return 'foo\\bar\041baz\';
end
$$ language plpgsql;

create or replace function strtest() returns text as $$
begin
  raise notice E'foo\\bar\041baz';
  return E'foo\\bar\041baz';
end
$$ language plpgsql;

DO $$
DECLARE r record;
BEGIN
    FOR r IN SELECT rtrim(roomno) AS roomno, comment FROM Room ORDER BY roomno
    LOOP
        RAISE NOTICE '%, %', r.roomno, r.comment;
    END LOOP;
END$$;

DO LANGUAGE plpgsql $$begin return 1; end$$;

DO $$
DECLARE r record;
BEGIN
    FOR r IN SELECT rtrim(roomno) AS roomno, foo FROM Room ORDER BY roomno
    LOOP
        RAISE NOTICE '%, %', r.roomno, r.comment;
    END LOOP;
END$$;

do $outer$
begin
  for i in 1..10 loop
   begin
    execute $ex$
      do $$
      declare x int = 0;
      begin
        x := 1 / x;
      end;
      $$;
    $ex$;
  exception when division_by_zero then
    raise notice 'caught division by zero';
  end;
  end loop;
end;
$outer$;

do $$
declare x int := x + 1;  -- error
begin
  raise notice 'x = %', x;
end;
$$;

do $$
declare y int := x + 1;  -- error
        x int := 42;
begin
  raise notice 'x = %, y = %', x, y;
end;
$$;

do $$
declare x int := 42;
        y int := x + 1;
begin
  raise notice 'x = %, y = %', x, y;
end;
$$;

do $$
declare x int := 42;
begin
  declare y int := x + 1;
          x int := x + 2;
          z int := x * 10;
  begin
    raise notice 'x = %, y = %, z = %', x, y, z;
  end;
end;
$$;

create function conflict_test() returns setof int8_tbl as $$
declare r record;
  q1 bigint := 42;
begin
  for r in select q1,q2 from int8_tbl loop
    return next r;
  end loop;
end;
$$ language plpgsql;

create or replace function conflict_test() returns setof int8_tbl as $$
#variable_conflict use_variable
declare r record;
  q1 bigint := 42;
begin
  for r in select q1,q2 from int8_tbl loop
    return next r;
  end loop;
end;
$$ language plpgsql;

create or replace function conflict_test() returns setof int8_tbl as $$
#variable_conflict use_column
declare r record;
  q1 bigint := 42;
begin
  for r in select q1,q2 from int8_tbl loop
    return next r;
  end loop;
end;
$$ language plpgsql;

create function unreserved_test() returns int as $$
declare
  forward int := 21;
begin
  forward := forward * 2;
  return forward;
end
$$ language plpgsql;

create or replace function unreserved_test() returns int as $$
declare
  return int := 42;
begin
  return := return + 1;
  return return;
end
$$ language plpgsql;

create or replace function unreserved_test() returns int as $$
declare
  comment int := 21;
begin
  comment := comment * 2;
  comment on function unreserved_test() is 'this is a test';
  return comment;
end
$$ language plpgsql;

create function foreach_test(anyarray)
returns void as $$
declare x int;
begin
  foreach x in array $1
  loop
    raise notice '%', x;
  end loop;
  end;
$$ language plpgsql;

create or replace function foreach_test(anyarray)
returns void as $$
declare x int;
begin
  foreach x slice 1 in array $1
  loop
    raise notice '%', x;
  end loop;
  end;
$$ language plpgsql;

create or replace function foreach_test(anyarray)
returns void as $$
declare x int[];
begin
  foreach x slice 1 in array $1
  loop
    raise notice '%', x;
  end loop;
  end;
$$ language plpgsql;

create or replace function foreach_test(anyarray)
returns void as $$
declare x int[];
begin
  foreach x slice 2 in array $1
  loop
    raise notice '%', x;
  end loop;
  end;
$$ language plpgsql;

create or replace function foreach_test(anyarray)
returns void as $$
declare r record;
begin
  foreach r in array $1
  loop
    raise notice '%', r;
  end loop;
  end;
$$ language plpgsql;

create or replace function foreach_test(anyarray)
returns void as $$
declare x int; y int;
begin
  foreach x, y in array $1
  loop
    raise notice 'x = %, y = %', x, y;
  end loop;
  end;
$$ language plpgsql;

create or replace function foreach_test(anyarray)
returns void as $$
declare x xy_tuple[];
begin
  foreach x slice 1 in array $1
  loop
    raise notice '%', x;
  end loop;
  end;
$$ language plpgsql;

create function arrayassign1() returns text[] language plpgsql as $$
declare
 r record;
begin
  r := row(12, '{foo,bar,baz}')::rtype;
  r.ar[2] := 'replace';
  return r.ar;
end$$;

create function testoa(x1 int, x2 int, x3 int) returns orderedarray
language plpgsql as $$
declare res orderedarray;
begin
  res := array[x1, x2];
  res[2] := x3;
  return res;
end$$;

create function returns_rw_array(int) returns int[]
language plpgsql as $$
  declare r int[];
  begin r := array[$1, $1]; return r; end;
$$ stable;

create function consumes_rw_array(int[]) returns int
language plpgsql as $$
  begin return $1[1]; end;
$$ stable;

do $$
declare a int[] := array[1,2];
begin
  a := a || 3;
  raise notice 'a = %', a;
end$$;

create function inner_func(int)
returns int as $$
declare _context text;
begin
  get diagnostics _context = pg_context;
  raise notice '***%***', _context;
  -- lets do it again, just for fun..
  get diagnostics _context = pg_context;
  raise notice '***%***', _context;
  raise notice 'lets make sure we didnt break anything';
  return 2 * $1;
end;
$$ language plpgsql;

create or replace function outer_func(int)
returns int as $$
declare
  myresult int;
begin
  raise notice 'calling down into inner_func()';
  myresult := inner_func($1);
  raise notice 'inner_func() done';
  return myresult;
end;
$$ language plpgsql;

create or replace function outer_outer_func(int)
returns int as $$
declare
  myresult int;
begin
  raise notice 'calling down into outer_func()';
  myresult := outer_func($1);
  raise notice 'outer_func() done';
  return myresult;
end;
$$ language plpgsql;

create function inner_func(int)
returns int as $$
declare
  _context text;
  sx int := 5;
begin
  begin
    perform sx / 0;
  exception
    when division_by_zero then
      get diagnostics _context = pg_context;
      raise notice '***%***', _context;
  end;

  -- lets do it again, just for fun..
  get diagnostics _context = pg_context;
  raise notice '***%***', _context;
  raise notice 'lets make sure we didnt break anything';
  return 2 * $1;
end;
$$ language plpgsql;

create function current_function(text)
returns regprocedure as $$
declare
  fn_oid regprocedure;
begin
  get diagnostics fn_oid = pg_routine_oid;
  return fn_oid;
end;
$$ language plpgsql;

do $$
declare
  fn_oid oid;
begin
  get diagnostics fn_oid = pg_routine_oid;
  raise notice 'pg_routine_oid = %', fn_oid;
end;
$$;

do $$
begin
  assert 1=1;  -- should succeed
end;
$$;

do $$
begin
  assert 1=0;  -- should fail
end;
$$;

do $$
begin
  assert NULL;  -- should fail
end;
$$;

do $$
begin
  assert 1=0;  -- won't be tested
end;
$$;

do $$
declare var text := 'some value';
begin
  assert 1=0, format('assertion failed, var = "%s"', var);
end;
$$;

do $$
begin
  assert 1=0, 'unhandled assertion';
exception when others then
  null; -- do nothing
end;
$$;

create function plpgsql_domain_check(val int) returns boolean as $$
begin return val > 0; end
$$ language plpgsql immutable;

do $$
declare v_test plpgsql_domain;
begin
  v_test := 1;
end;
$$;

do $$
declare v_test plpgsql_domain := 1;
begin
  v_test := 0;  -- fail
end;
$$;

create function plpgsql_arr_domain_check(val int[]) returns boolean as $$
begin return val[1] > 0; end
$$ language plpgsql immutable;

do $$
declare v_test plpgsql_arr_domain;
begin
  v_test := array[1];
  v_test := v_test || 2;
end;
$$;

do $$
declare v_test plpgsql_arr_domain := array[1];
begin
  v_test := 0 || v_test;  -- fail
end;
$$;

CREATE FUNCTION transition_table_base_ins_func()
  RETURNS trigger
  LANGUAGE plpgsql
AS $$
DECLARE
  t text;
  l text;
BEGIN
  t = '';
  FOR l IN EXECUTE
           $q$
             EXPLAIN (TIMING off, COSTS off, VERBOSE on)
             SELECT * FROM newtable
           $q$ LOOP
    t = t || l || E'\n';
  END LOOP;

  RAISE INFO '%', t;
  RETURN new;
END;
$$;

CREATE OR REPLACE FUNCTION transition_table_base_upd_func()
  RETURNS trigger
  LANGUAGE plpgsql
AS $$
DECLARE
  t text;
  l text;
BEGIN
  t = '';
  FOR l IN EXECUTE
           $q$
             EXPLAIN (TIMING off, COSTS off, VERBOSE on)
             SELECT * FROM oldtable ot FULL JOIN newtable nt USING (id)
           $q$ LOOP
    t = t || l || E'\n';
  END LOOP;

  RAISE INFO '%', t;
  RETURN new;
END;
$$;

CREATE FUNCTION transition_table_level1_ri_parent_del_func()
  RETURNS TRIGGER
  LANGUAGE plpgsql
AS $$
  DECLARE n bigint;
  BEGIN
    PERFORM FROM p JOIN transition_table_level2 c ON c.parent_no = p.level1_no;
    IF FOUND THEN
      RAISE EXCEPTION 'RI error';
    END IF;
    RETURN NULL;
  END;
$$;

CREATE FUNCTION transition_table_level1_ri_parent_upd_func()
  RETURNS TRIGGER
  LANGUAGE plpgsql
AS $$
  DECLARE
    x int;
  BEGIN
    WITH p AS (SELECT level1_no, sum(delta) cnt
                 FROM (SELECT level1_no, 1 AS delta FROM i
                       UNION ALL
                       SELECT level1_no, -1 AS delta FROM d) w
                 GROUP BY level1_no
                 HAVING sum(delta) < 0)
    SELECT level1_no
      FROM p JOIN transition_table_level2 c ON c.parent_no = p.level1_no
      INTO x;
    IF FOUND THEN
      RAISE EXCEPTION 'RI error';
    END IF;
    RETURN NULL;
  END;
$$;

CREATE FUNCTION transition_table_level2_ri_child_insupd_func()
  RETURNS TRIGGER
  LANGUAGE plpgsql
AS $$
  BEGIN
    PERFORM FROM i
      LEFT JOIN transition_table_level1 p
        ON p.level1_no IS NOT NULL AND p.level1_no = i.parent_no
      WHERE p.level1_no IS NULL;
    IF FOUND THEN
      RAISE EXCEPTION 'RI error';
    END IF;
    RETURN NULL;
  END;
$$;

CREATE FUNCTION transition_table_level2_bad_usage_func()
  RETURNS TRIGGER
  LANGUAGE plpgsql
AS $$
  BEGIN
    INSERT INTO dx VALUES (1000000, 1000000, 'x');
    RETURN NULL;
  END;
$$;

CREATE FUNCTION alter_table_under_transition_tables_upd_func()
  RETURNS TRIGGER
  LANGUAGE plpgsql
AS $$
BEGIN
  RAISE WARNING 'old table = %, new table = %',
                  (SELECT string_agg(id || '=' || name, ',') FROM d),
                  (SELECT string_agg(id || '=' || name, ',') FROM i);
  RAISE NOTICE 'one = %', (SELECT 1 FROM alter_table_under_transition_tables LIMIT 1);
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION multi_test_trig() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    RAISE NOTICE 'count = %', (SELECT COUNT(*) FROM new_test);
    RAISE NOTICE 'count union = %',
      (SELECT COUNT(*)
       FROM (SELECT * FROM new_test UNION ALL SELECT * FROM new_test) ss);
    RETURN NULL;
END$$;

CREATE OR REPLACE FUNCTION get_from_partitioned_table(partitioned_table.a%type)
RETURNS partitioned_table AS $$
DECLARE
    a_val partitioned_table.a%TYPE;
    result partitioned_table%ROWTYPE;
BEGIN
    a_val := $1;
    SELECT * INTO result FROM partitioned_table WHERE a = a_val;
    RETURN result;
END; $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION list_partitioned_table()
RETURNS SETOF public.partitioned_table.a%TYPE AS $$
DECLARE
    row public.partitioned_table%ROWTYPE;
    a_val public.partitioned_table.a%TYPE;
BEGIN
    FOR row IN SELECT * FROM public.partitioned_table ORDER BY a LOOP
        a_val := row.a;
        RETURN NEXT a_val;
    END LOOP;
    RETURN;
END; $$ LANGUAGE plpgsql;

CREATE FUNCTION fx(x WSlot) RETURNS void AS $$
BEGIN
  GET DIAGNOSTICS x = ROW_COUNT;
  RETURN;
END; $$ LANGUAGE plpgsql;
