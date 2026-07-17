UPDATE users
SET email = CASE email
  WHEN 'edson.sousa@assofig.local' THEN 'edsonmflavio@gmail.com'
  WHEN 'jamili.bernardino@assofig.local' THEN 'milli_dias@yahoo.com.br'
  WHEN 'saulo.leite@assofig.local' THEN 'saulo1979@gmail.com'
  WHEN 'talita.malaman@assofig.local' THEN 'tamalaman@gmail.com'
  WHEN 'angela.magri@assofig.local' THEN 'minasangel@yahoo.com.br'
  WHEN 'isabela.simon@assofig.local' THEN 'isabela.scali@hotmail.com'
  ELSE email
END,
updated_at = NOW()
WHERE email IN (
  'edson.sousa@assofig.local',
  'jamili.bernardino@assofig.local',
  'saulo.leite@assofig.local',
  'talita.malaman@assofig.local',
  'angela.magri@assofig.local',
  'isabela.simon@assofig.local'
);

UPDATE associados
SET email = CASE email
  WHEN 'edson.sousa@assofig.local' THEN 'edsonmflavio@gmail.com'
  WHEN 'jamili.bernardino@assofig.local' THEN 'milli_dias@yahoo.com.br'
  WHEN 'saulo.leite@assofig.local' THEN 'saulo1979@gmail.com'
  WHEN 'talita.malaman@assofig.local' THEN 'tamalaman@gmail.com'
  WHEN 'angela.magri@assofig.local' THEN 'minasangel@yahoo.com.br'
  WHEN 'isabela.simon@assofig.local' THEN 'isabela.scali@hotmail.com'
  ELSE email
END,
updated_at = NOW()
WHERE email IN (
  'edson.sousa@assofig.local',
  'jamili.bernardino@assofig.local',
  'saulo.leite@assofig.local',
  'talita.malaman@assofig.local',
  'angela.magri@assofig.local',
  'isabela.simon@assofig.local'
);
