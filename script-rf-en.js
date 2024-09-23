/*
PROJECT
Supervised classification of agricultural areas in a region of Brazil, applying the Random Forest classifier to Sentinel-2 satellite imagery. Coded in JavaScript for the Google Earth Engine (GEE) IDE.



OBJECTIVES
- Create mosaics for the years 2017 and 2023;
- Model training, classification, and validation;
- Calculation of model accuracy using the Confusion Matrix;
- Historical analysis of the agricultural areas;
- Rendering of the classified maps and other products.


PRELIMINARY CONCLUSIONS
- The high training accuracy (99.42%) indicates that the model is fitting well to the training data, with low classification errors. 
- The very small number of false positives (2 and 0) and false negatives (1 and 3) suggests confidence in the results obtained.
- For validation, the accuracy of 97.14% is also a good metric, indicating that the Random Forest model is performing well in classifying areas as 'agriculture'. 
- The low number of false positives (1) and false negatives (4) further reinforces confidence in the results.
- The combination of high training and validation accuracy may indicate that the model is generalizing well and not overfitting.
- Based on the classification results, the area occupied by agriculture in 2023 increased by 6.24% compared to 2017, expanding from 26,258.22 km² to 27,897.09 km².
- This percentage represents an additional 1,639 km² of areas converted to agriculture during this period.


NEXT STEPS
- Use/exploration of the Dynamic World dataset for classifying areas (DW has high potential for this type of problem. Besides having good temporal resolution and a spatial resolution of 10m—similar to the Sentinel-2 images used in this script—it uses solid data sources, such as Mapbiomas, which has customized and detailed classifications for the Brazilian territory);
- Use/classification for other land uses and land cover categories to enrich the analysis;
- Creation of time series and NDVI graphs for increasing accuracy in sample collection and classification;
- Generation of complementary performance metrics for the model, such as precision and recall;
- Performance measurement for each band for the algorithm processing;
- Fine-tuning/parameter tuning: Adjustment of parameters and fine-tuning of the model to optimize accuracy and other metrics;
- Generation of dynamic/animated maps indicating the annual evolution of the target-classes;
- Apply a new refactoring layer;
- Final testing;
- Documentation review and refinement.
*/


// STEP 1 - RESOURCES AND AOI

// Definition of the target area according to the project requirements
var geometry = ee.Geometry.Polygon([
  [
    [-58.389544224642215, -11.200339407332578],
    [-58.389544224642215, -13.336554634910579],
    [-55.906634068392215, -13.336554634910579],
    [-55.906634068392215, -11.200339407332578]
  ]
]);

// Function to create a shadow mask using NDVI and SWIR
var createShadowMask = function(img) {
  var ndvi = img.normalizedDifference(['B8', 'B4']);
  var shadowNDVI = ndvi.lt(0.1); // low NDVI values (predictor of shadow)
  var swir = img.select('B11');
  var shadowSWIR = swir.lt(1000); // low SWIR values (predictor of shadow)
  var shadowsMask = shadowNDVI.and(shadowSWIR);
  return img.updateMask(shadowsMask.not()); // Inverted mask for removal and update
};

// Function to remove clouds and shadows
var removeCloudShadows = function(img){
  var qa = img.select('QA60'); // Cloud band
  var cloudMask = qa.eq(0);
  img = createShadowMask(img); // Application of the shadow mask
  return img.updateMask(cloudMask); // Application of the cloud mask
};

/* NOTE
Initially, based on the problem requirements, the most appropriate image collection for this analysis would be 'S2_SR_HARMONIZED'. 
It provides surface reflectance data instead of top-of-atmosphere (TOA) data like the 'S2' and 'S2_HARMONIZED' collections. 
However, 'S2_SR_HARMONIZED' data for 2017 is not available.

Using 'S2' for 2017 and 'S2_SR' for 2023 is not a suitable solution, as the two satellites 2A and 2B, although similar, have different radiometric calibrations. 
Therefore, the images would not be consistent when comparing each other.

The chosen solution for this scenario prioritizes the CONSISTENCY of the data to ensure that the Random Forest classifier works accurately and reliably. 
The 'S2_HARMONIZED' collection was chosen for 2017 AND 2023, applying all possible treatments to adjust the effects of the atmosphere (clouds, shadow, aerosols, and others).
The 'S2_HARMONIZED' collection includes the QA60 band for the period, easing pre-processing.

In addition to cloud and shadow correction, the feasibility of other possibilities was also considered, such as applying the 6S, DOS, SCC methods, and external processing via Sen2Cor, for instance.
The application of SIAC consumed too many computational resources, while the ideal scenario would still be its application to each image that would generate the mosaic.
Thus, a more objective and compatible approach with the classification problem was chosen.
*/

// Função para criar mosaico com input do ano desejado
var criarMosaico = function(ano, geometry) {
  var dataInicio = ano + '-01-01';
  var dataFim = ano + '-12-31';
  var S2 = ee.ImageCollection("COPERNICUS/S2_HARMONIZED")
               .filterBounds(geometry)
               .filterDate(dataInicio, dataFim)
               .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 5)) // Homogeneizar imagens com poucas nuvens
               .map(removeCloudShadows)
               .median()
               .clip(geometry);
  
  // Calculo de NDVI and NDVI + Bandas para a classificação supervisionada
  var ndvi = S2.normalizedDifference(['B8', 'B4']).rename('NDVI');
  var ndviS2 = ndvi.addBands(S2);
  
  // Parâmetros de Visualização
  var visualRGB = {min: 300, max: 3000, bands: ['B4', 'B3', 'B2']}; // True color
  var visualNDVI = {min: -1, max: 1, palette: ['red', 'yellow', 'green']}; // NDVI padrão
  
  // Renderização dos mosaicos e NDVI
  Map.addLayer(S2, visualRGB, "Mosaico " + ano);
  Map.addLayer(ndvi, visualNDVI, "NDVI " + ano);
  
  // Exportaç~ão dos Mosaicos
  Export.image.toDrive({
    image: S2,
    description: 'Mosaico_Sentinel_' + ano,
    folder: 'Sentinel_Mosaic_Export',
    region: geometry,
    maxPixels: 1e13,
    fileFormat: 'GeoTIFF',
    scale: 20
  });
  
  // Exportação do NDVI
  Export.image.toDrive({
    image: ndvi,
    description: 'NDVI_Sentinel_' + ano,
    folder: 'Sentinel_Mosaic_Export',
    region: geometry,
    maxPixels: 1e13,
    fileFormat: 'GeoTIFF',
    scale: 20
  });


// ETAPA 2 - CLASSIFICAÇÃO SUPERVISIONADA COM RANDOM FOREST

/* 
Seleção de amostras feita manualmente.
Para ser mais assertivo e eficiente diante do requisito do problema, optou-se abordar somente DUAS classes: 'agricultura' e 'demais_usos'.
Coleta de amostras realizada com suporte de dados NDVI e do Dynamic World. 
*/

  // Definição e merge das amostras
  var amostras = agricultura.merge(demais_usos);
  
  // Bandas para classificação
  // Descartou-se as bandas B1(60m)(Aerossol), B9(60m)(Vapor d'agua) e B10(60m)(cirrus)
  var bandas = ['NDVI','B2','B3','B4','B5','B6','B7','B8','B8A','B11','B12']; 
  
  // Especificações do split de treino/teste
  var sample = amostras.randomColumn();
  var trainingSample = sample.filter('random <= 0.75');
  var validationSample = sample.filter('random > 0.75');
  print('Amostra de treino:', trainingSample);
  print('Amostra de teste:', validationSample);
  
  // Variável de treinamento
  var treinamento = ndviS2.select(bandas).sampleRegions({
    collection: trainingSample,
    properties: ['class'],
    scale: 10
  });
  print(treinamento, 'Valores de bandas para treino');
  
  // Variável de teste/validação
  var validation = ndviS2.select(bandas).sampleRegions({
    collection: validationSample,
    properties: ['class'],
    scale: 10
  });
  
  // Especificações do classificador Random Forest
  var classificador_RF = ee.Classifier.smileRandomForest({
    numberOfTrees: 200, 
    seed: 42
  }).train({
    features: treinamento,
    classProperty: 'class'
  });

  // Aplicação do classificador
  var classificacao = ndviS2.classify(classificador_RF).clip(geometry);

  // Renderização dos mapas classificados
  Map.addLayer(classificacao, {min:0, max:1, palette: ['yellow', 'green']}, 'Classificação RF ' + ano);

  // Exportação do produto classificado
  Export.image.toDrive({
    image: classificacao,
    description: 'Classificacao_RF_' + ano,
    folder: 'Sentinel_Mosaic_Export',
    region: geometry,
    maxPixels: 1e13,
    fileFormat: 'GeoTIFF',
    scale: 20
  });
  
  
// ETAPA 3 - AVALIAÇÃO DA ACURÁCIA - MATRIZ DE CONFUSÃO

/*
Optou-se pela matriz de confusão como método para avaliação do modelo.
Se trata de uma ferramenta disseminada e eficiente para avaliar modelos de classificação.
Derivado da matriz, podem-se extrair métricas importantes, como a acurácia. 
*/

  // Matriz de confusão e acurácia para a amostra de treino
  var trainAccuracy = classificador_RF.confusionMatrix();
  print('Matriz de confusão: treinamento', trainAccuracy);
  print('Acurácia do treino:', trainAccuracy.accuracy());
  
  // Matriz de confusão e acurácia para a amostra de teste/validação.
  validation = validation.classify(classificador_RF);
  var validationAccuracy = validation.errorMatrix('class', 'classification'); 
  print('Matriz de confusão: validação', validationAccuracy);
  print('Acurácia da validação:', validationAccuracy.accuracy());

  return classificacao;
};


// ETAPA 4 - GERAR CLASSIFICAÇÃO E ANALISAR RESULTADOS

// Gerar os mosaicos e classificar para os anos requeridos (2017 e 2023)
var classificacao2017 = criarMosaico('2017', geometry);
var classificacao2023 = criarMosaico('2023', geometry);

// Cômputo da área de agricultura para ambos os anos
var areaAgricultura = function(classificacao, ano) {
  var agricultura = classificacao.eq(0);
  var area = agricultura.multiply(ee.Image.pixelArea()).reduceRegion({
    reducer: ee.Reducer.sum(),
    geometry: geometry,
    scale: 80, // Escala alterada para corrigir falta de memória computacional
    maxPixels: 1e13
  }).get('classification');
  print('Área de Agricultura em ' + ano + ':', ee.Number(area).divide(1e6).format('%.2f km²'));
  return area;
};

var area2017 = areaAgricultura(classificacao2017, '2017');
var area2023 = areaAgricultura(classificacao2023, '2023');

// Cômputo da diferença de área ocupada
var diffArea = ee.Number(area2023).subtract(ee.Number(area2017));
print('Diferença na área de Agricultura entre 2023 e 2017:', diffArea.divide(1e6).format('%.2f km²'));

// Centralização
Map.centerObject(geometry);
