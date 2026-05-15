# Catalunya crime mapping

The task is to prepare interactive map that easily show crime statistics in Catalunya that is not obvious from existing https://visors.icgc.cat/mapa-delinquencial/ resource. 
Mainly – to be able to compare with means across Spain + to see composit index
that is useful to get the understanding of "outdoor safety".

During the app preparation the crime data is parsed from open data sources.

The service is MVP for visualization and personal understanding purposes. 

The web interface should work by the following principle:

User can choose the date on the time slider, filter by exact crime type or see general safety index. 
He can see the whole statistics by each type in every point in Catalunya.

Stack – React, Maplibre. Data is stored in gpkg and geojsons

No authentication needed for now. Interface is simple.
