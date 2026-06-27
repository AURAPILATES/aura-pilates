-- Permite fijar a mano la subdivisión económica (personal / operational / capex) de una
-- categoría operacional. Antes se derivaba solo del nombre (ver STARTUP_CATS/PERSONAL_CATS
-- en lib/economicGroups.ts), por lo que renombrar una categoría la movía de grupo sin forma
-- de corregirlo. Si economic_group es null, se sigue derivando del nombre (fallback legacy).
alter table categories add column if not exists economic_group text;
