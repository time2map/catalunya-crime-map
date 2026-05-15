# Данные по преступности Каталонии — Mossos d'Esquadra

Данные взяты с сайта [Mapa Delinquencial ICGC](https://visors.icgc.cat/mapa-delinquencial/) — официальной карты преступности Generalitat de Catalunya, опубликованной Департаментом внутренних дел (Departament d'Interior).

## Источник

- **Сайт-визуализатор:** https://visors.icgc.cat/mapa-delinquencial/
- **Организация:** Institut Cartogràfic i Geològic de Catalunya (ICGC) + Mossos d'Esquadra
- **Данные:** Departament d'Interior, Generalitat de Catalunya
- **Открытые данные:** https://administraciodigital.gencat.cat/ca/dades/dades-obertes/informacio-practica/llicencies/

## Лицензия и условия использования

Данные опубликованы под лицензией **CC BY 4.0** (Creative Commons Attribution):

- Свободно использовать в коммерческих и некоммерческих проектах
- Распространять, модифицировать, интегрировать в сервисы
- **Требование:** указать авторство: *Departament d'Interior, Generalitat de Catalunya*

## Структура репозитория

```
crimes-parser/
├── extract_abp_polygons.py         # скрипт для скачивания и сборки данных
└── data/
    ├── crimes_catalunya.gpkg       # основной файл для QGIS (30 МБ)
    ├── abp_polygons_clean.geojson  # полигоны ABP в GeoJSON (23 МБ)
    ├── comissaries.geojson         # точки участков Mossos d'Esquadra (356 КБ)
    ├── Fets_combined_2019_2026.csv # все годы объединены (19 МБ)
    └── Fets_2019.csv … Fets_2026.csv # статистика по годам (0.5–2.9 МБ)
```

## Запуск скрипта

Скрипт скачивает все данные с нуля и собирает итоговый GeoPackage в папку `data/`.

### Зависимости

```bash
pip install geopandas shapely pandas
```

Также нужен **GDAL** с утилитой `ogr2ogr` в PATH:

```bash
# macOS
brew install gdal

# Ubuntu/Debian
sudo apt install gdal-bin
```

### Запуск

```bash
cd crimes-parser
python extract_abp_polygons.py
```

Скрипт последовательно:
1. Скачивает `Fets_YYYY.csv` за каждый доступный год (2019 — текущий)
2. Скачивает `comissaries.geojson` и исправляет битые координаты
3. Собирает `Fets_combined_YYYY_YYYY.csv`
4. Скачивает ~1520 vector tile тайлов (zoom 12) с границами ABP-зон
5. Декодирует тайлы через GDAL, сшивает полигоны по ABP-коду
6. Присоединяет статистику преступлений к полигонам
7. Сохраняет `abp_polygons_clean.geojson` и `crimes_catalunya.gpkg`

Время выполнения: ~3–5 минут (зависит от скорости соединения).

---

## Структура данных

### 1. `crimes_catalunya.gpkg` — GeoPackage для QGIS

Содержит один слой: **`abp_polygons`** — 59 полигонов ABP-зон с присоединённой статистикой преступлений.

**Как получены полигоны:** скачаны из vector tile сервиса ICGC (`tilemaps.icgc.cat/vt/tiles/limits_vigentv42/`) на zoom 12 (1520 тайлов), декодированы через GDAL с точной геопривязкой, сшиты по ABP-коду через `shapely.unary_union`.

**Как загрузить в QGIS:**
1. Слой → Добавить слой → Векторный слой → `data/crimes_catalunya.gpkg`
2. Выбрать слой `abp_polygons`
3. Хороплет-карта: Свойства → Символика → Градуированный → поле `total_coneguts`

#### Поля слоя `abp_polygons`

| Поле | Тип | Описание |
|------|-----|----------|
| `abp_c` | string | Код ABP |
| `abp_d` | string | Название ABP-зоны (краткое) |
| `abp_name` | string | Полное название (`Àrea Bàsica Policial …`) |
| `regio_c` | string | Полицейский регион |
| `abp_pob` | int | Население зоны |
| `abp_csv` | string | Название ABP как в исходных CSV |
| `total_coneguts` | int | Всего зарегистрировано случаев (2019–2026) |
| `total_resolts` | int | Всего раскрыто |
| `total_detencions` | int | Всего задержаний |
| `regio_policial` | string | Полицейский регион (из CSV) |
| `coneguts_2019` … `coneguts_2026` | int | Зарегистрировано по каждому году |

#### Покрытие полигонов

59 из 62 ABP-зон получили полигоны. Три без полигонов:
- **ABP Virtual** — онлайн-преступления, территории нет
- **ABP Barcelona** — исторический агрегат, в границах 2024 разбит по районным ABP
- **ABP Pla d'Urgell - Garrigues** — отсутствует в векторных границах 2024 года

8 ABP-зон имеют тип `MultiPolygon` — это реальные административные эксклавы в источнике (не артефакты тайлинга): Segrià, Pallars Jussà - Pallars Sobirà, Segarra - Urgell, Solsonès, Cerdanya, Berguedà, Ripollès, Sarrià-Sant Gervasi.

---

### 2. `Fets_{год}.csv` — Статистика преступности по месяцам

Данные агрегированы по месяцу / ABP / типу преступления. **Индивидуальные случаи не публикуются.**

**Покрытие:** январь 2019 — текущий год (файл текущего года обновляется на сайте с задержкой ~1–2 месяца).

| Колонка | Тип | Описание |
|---------|-----|----------|
| `Mes` | int | Номер месяца (1–12) |
| `Nom mes` | string | Название месяца (каталанский) |
| `Any` | int | Год |
| `Regió Policial (RP)` | string | Полицейский регион (10 регионов) |
| `Àrea Bàsica Policial (ABP)` | string | Базовая полицейская зона (62 зоны) |
| `Títol Codi Penal` | string | Раздел Уголовного кодекса |
| `Tipus de fet` | string | Тип преступления |
| `Coneguts` | int | Зарегистрировано случаев |
| `Resolts` | int | Раскрыто |
| `Detencions` | int | Задержано |

**Разделитель:** `;`, кодировка: UTF-8 BOM.

**Объём:**

| Файл | Записей |
|------|---------|
| Fets_2019.csv | 20 602 |
| Fets_2020.csv | 19 989 |
| Fets_2021.csv | 20 861 |
| Fets_2022.csv | 20 879 |
| Fets_2023.csv | 21 963 |
| Fets_2024.csv | 22 249 |
| Fets_2025.csv | 22 463 |
| Fets_2026.csv | 3 626 (неполный) |
| **Fets_combined_2019_2026.csv** | **152 632** |

---

### 3. `comissaries.geojson` — Точки участков Mossos d'Esquadra

GeoJSON FeatureCollection, 587 объектов, CRS EPSG:4326.

| Поле | Описание |
|------|----------|
| `nom` | Название |
| `tipus` | Тип объекта (см. ниже) |
| `municipi` | Муниципалитет |
| `comarca` | Комарка |
| `adre_a` | Адрес |
| `cp` | Почтовый индекс |
| `codi_ine` | Код INE муниципалитета |
| `horari` | Режим работы |
| `den_ncies` | Принимаются ли заявления (Sí/No) |
| `any` | Год открытия |
| `longitud` / `latitud` | Координаты |

| Тип | Кол-во |
|-----|--------|
| `Àrea Bàsica Policial` | 295 |
| `Comissaria de Districte` | 154 |
| `Oficina Policial` | 82 |
| `Àrea Regional de Trànsit` | 40 |
| `Altres dependències` | 10 |
| `Oficina d'Atenció Ciutadana` | 6 |

Исправлены 2 записи с некорректными координатами (широта 41409356 вместо 41.409356).

---

## Полицейские регионы (RP)

| Регион | Охват |
|--------|-------|
| RP Metropolitana Barcelona | Барселона и пригороды |
| RP Metropolitana Nord | Северные пригороды Барселоны |
| RP Metropolitana Sud | Южные пригороды Барселоны |
| RP Girona | Провинция Жирона |
| RP Camp de Tarragona | Провинция Таррагона |
| RP Central | Центральная Каталония |
| RP Ponent | Западная Каталония (Лерида) |
| RP Alt Pirineu i Aran | Пиренеи и Аран |
| RP Terres de l'Ebre | Дельта Эбро |
| Regió Virtual | Онлайн-преступления |

---

## Типы преступлений (`Tipus de fet`)

Сгруппированы по разделу Уголовного кодекса (`Títol Codi Penal`).

**Подделки и фальсификации** (De les falsedats)
- Присвоение гражданского состояния (De la usurpació de l'estat civil)
- Подделка документов (Falsedats documentals)
- Изготовление фальшивых денег и ценных бумаг (Falsificació de moneda i efectes timbrats)
- Самозванство и незаконная практика (Usurpació de funcions públiques i intrusisme)

**Причинение вреда здоровью** (De les lesions)
- Телесные повреждения (Lesions)

**Причинение вреда здоровью плода** (De les lesions al fetus)
- Повреждение плода (Lesions al fetus)

**Пытки и иные преступления против нравственной неприкосновенности** (De les tortures i altres delictes contra la integritat moral)
- Пытки (Tortures)
- Унижающее достоинство обращение (Tracte degradant / vexatori)

**Аборт** (De l'avortament)
- Незаконный аборт (Avortament)

**Убийство и смежные преступления** (De l'homicidi i les seves formes)
- Убийство с отягчающими обстоятельствами (Assassinat Consumat)
- Покушение на убийство с отягчающими обстоятельствами (Assassinat Temptativa)
- Убийство (Homicidi Consumat)
- Покушение на убийство (Homicidi Temptativa)
- Убийство по неосторожности (Homicidi per imprudència)
- Склонение и содействие суициду (Inducció i cooperació al suïcidi)

**Оставление в опасности** (De l'omissió del deure d'auxili)
- Неоказание помощи (Omissió del deure de socors)

**Торговля людьми** (Del tràfic d'éssers humans)
- Торговля людьми (Tràfic d'éssers humans)

**Преступления против собственности и экономического порядка** (Delictes contra el patrimoni i contra l'ordre socioeconòmic)
- Недобросовестное управление имуществом (Administració deslleial)
- Присвоение (Apropiació indeguda)
- Отмывание денег (Blanqueig de capitals)
- Причинение ущерба (Danys)
- Незаконное использование электроэнергии и аналогичные преступления (Defraudacions de fluid elèctric i anàlogues)
- Мошенничество (Estafes)
- Вымогательство (Extorsió)
- Воспрепятствование исполнению судебных решений (Frustració d'execució)
- Кража без насилия (Furt)
- Нарушения в сфере рынка и защиты потребителей (Mercat i consumidors)
- Самовольное занятие помещений (Ocupació immobles)
- Нарушение прав промышленной собственности (Propietat industrial)
- Нарушение авторских прав (Propietat intel·lectual)
- Скупка краденого и смежные деяния (Receptació i altres conductes afins)
- Кража со взломом (Robatori amb força)
- Кража из транспортного средства со взломом (Robatori amb força interior vehicle)
- Грабёж с насилием или угрозой (Robatori amb violència i/o intimidació)
- Угон транспортного средства (Robatori i furt d'us de vehicle)
- Изъятие собственного имущества, имеющего социальную ценность (Sostracció de cosa pròpia d'utilitat social)
- Самоуправное завладение недвижимостью (Usurpació)

**Преступления против животных** (Delictes contra els animals)
- Жестокое обращение с животными (Contra els animals)

**Преступления против прав иностранных граждан** (Delictes contra els drets dels ciutadans estrangers)
- Нарушение прав иностранных граждан (Contra els drets de ciutadans estrangers)

**Преступления против правосудия** (Delictes contra l'Administració de justícia)
- Ложный донос и инсценировка преступления (Acusació, denúncia falsa i simulació de delictes)
- Укрывательство (Encobriment)
- Лжесвидетельство (Fals testimoni)
- Воспрепятствование правосудию и профессиональная нелояльность (Obstrucció a la justícia i deslleialtat professional)
- Несообщение о готовящемся преступлении (Omissió dels deures d'impedir delictes)
- Самоуправство (Realització arbitrària del propi dret)
- Нарушение условий наказания (Trencament de condemna)

**Преступления против государственного управления** (Delictes contra l'Administració pública)
- Неповиновение и отказ в содействии должностному лицу (Desobediència i denegació d'auxili)
- Растрата (Malversació)
- Взяточничество (Suborn)
- Торговля влиянием (Tràfic d'influències)

**Преступления против общественного порядка** (Delictes contra l'ordre públic)
- Иные преступления против общественного порядка (Altres delictes contra l'ordre públic)
- Массовые беспорядки (Desordres públics)
- Преступные организации и группировки (Organitzacions i grups criminals)

**Преступления против Конституции** (Delictes contra la Constitució)
- Нарушение основных прав и свобод граждан (Contra exercici drets fonamentals i llibertats públiques)
- Нарушение свободы совести, религии и надругательство над покойными (Contra la llibertat de consciència, religió i respecte als difunts)
- Преступления против государственных институтов и разделения властей (Contra les institucions de l'Estat i divisió de poders)

**Преступления против частной жизни, изображения и неприкосновенности жилища** (Delictes contra la intimitat, el dret a la pròpia imatge i la inviolabilitat del domicili)
- Раскрытие личных тайн (Descobriment i revelació de secrets)
- Незаконное проникновение в служебное помещение (Entrada a domicili aliè)
- Незаконное проникновение в жилище (Entrada a vivenda aliena)

**Преступления против свободы** (Delictes contra la llibertat)
- Угрозы (Amenaces)
- Принуждение (Coaccions)
- Незаконное лишение свободы (Detenció il·legal)
- Похищение человека (Segrest)

**Преступления против половой свободы и неприкосновенности** (Delictes contra la llibertat i la indemnitat sexuals)
- Изнасилование и сексуальное насилие (Agressions sexuals i Abusos sexuals)
- Сексуальное домогательство (Assetjament sexual)
- Эксгибиционизм и сексуальная провокация (Exhibicionisme i provocació sexual)
- Проституция (Relatius a la prostitució)
- Иные сексуальные преступления (Resta delictes sexuals)

**Преступления против безопасности дорожного движения** (Delictes contra la seguretat viària)
- Оставление места ДТП (Abandonament lloc accident)
- Опасное вождение (Conducció temerària)
- Управление транспортом без прав (Conduir sense permís)
- Управление в состоянии алкогольного или наркотического опьянения (Conduir sota els efectes d'alcohol i drogues)
- Отказ от освидетельствования (Negativa a sotmetre's a les proves)
- Создание серьёзной угрозы на дороге (Originar un greu risc per la circulació)
- Превышение скорости, влекущее уголовную ответственность (Velocitat penalment punible)

**Преступления против семейных отношений** (Delictes contra les relacions familiars)
- Нарушение семейных прав и обязанностей (Contra els drets i deures familiars)

**Преступления против чести** (Delictes contra l'honor)
- Клевета (Calúmnia)
- Оскорбление (Injúria)

**Преступления против трудовых прав** (Dels delictes contra els drets dels treballadors)
- Нарушение прав работников (Contra els drets dels treballadors)

**Преступления против налоговой системы и социального страхования** (Dels delictes contra la hisenda pública i contra la Seguretat Social)
- Налоговые преступления и нарушения в сфере социального страхования (Hisenda pública i seguretat social)

**Преступления против общественной безопасности** (Dels delictes contra la seguretat col·lectiva)
- Преступления в сфере здравоохранения / наркотики (Contra la salut pública)
- Поджог (Incendi)
- Создание катастрофической угрозы (Risc catastròfic)

**Преступления против территориального планирования, исторического наследия и окружающей среды** (Dels delictes relatius a l'ordenació del territori i l'urbanisme, la protecció del patrimoni històric i el medi ambient)
- Преступления против исторического наследия (Contra el patrimoni històric)
- Преступления против природных ресурсов и окружающей среды (Contra els recursos naturals i el medi ambient)
- Нарушения в сфере территориального планирования (Contra l'ordenació del territori)
- Защита флоры, фауны и домашних животных (Protecció de la flora, fauna i animals domèstics)

---

## Ограничения

- **Нет координат отдельных событий** — только агрегаты по ABP
- **Только Mossos d'Esquadra** — без Guardia Urbana (городской полиции Барселоны)
- **Агрегация по месяцам** — нет дат конкретных событий
- **С 2019 года** — более ранних данных через этот источник нет
