/*
PROJETO
Classificação supervisionada de áreas de agricultura em imagens de satelite Sentinel-2 usando o classificador Random Forest.

OBJETIVOS
- Criação de mosaicos para os anos de 2017 e 2023;
- Treinamento, classificação e validação do modelo;
- Cálculo de acurácia do modelo a partir da Matriz de Confusão;
- Análise histórica das áreas ocupadas de agricultura;
- Renderização dos mapas classificados e demais produtos. 

CONCLUSÕES PRELIMINARES
- A alta acurácia de treinamento (99.42%) indica que o modelo está se ajustando bem aos dados de treino, com baixos erros de classificação. 
A quantidade muito pequena de falsos positivos (2 e 0) e falsos negativos (1 e 3) indica a confiança nos resultados obtidos.

- Para a validação, a acurácia de 97.14% também é alta, indicando que o modelo de Random Forest está desempenhando muito bem na classificação das áreas como agricultura. 
A quantidade de falsos positivos (1) e falsos negativos (4) é baixa reforça a confiança nos resultados.

- A combinação da alta acurácia de treinamento e de validação podem indicar que o modelo está generalizando bem, e que não está sobreajustado (overfitting).

- Com base na classificação, a área ocupada por agricultura no ano de 2023 aumentou 6,24 % em comparação com o ano de 2017, avançando de 26.258,22 km² para 27.897,09 km². 
Este percentual representa 1.639 km² adicionais de áreas convertidas para agricultura durante o período.


PRÓXIMAS ETAPAS e OPORTUNIDADES DE MELHORIA
- Utilização/exploração do dataset do Dynamic World para a classificação das áreas (DW possui alto potencial de uso para este tipo de problema. 
Além da boa resolução temporal, e de possuir resolução espacial de 10m (como as Imagens Sentinel-2 utilizadas neste script) utiliza sólidas fontes de dados, entre elas, o Mapbiomas, que possui com classificação personalizada e particularizada para o território brasileiro; 
- Utilização/classificação de outras categorias de uso e ocupação do solo, visando enriquecer a análise.
- Criação de séries temporais e gráficos de NDVI, visando maior precisão na coleta de amostras e classificação;  
- Geração de métricas complementares de desempenho do modelo, como a precisão e o recall, por exemplo;
- Cálculo da importância de cada banda no processamento feito pelo algoritmo;
- Fine tuning/paramater tuning: Ajuste dos parâmetros e ajuste fino do modelo para otimizar a acurácia e as demais métricas;
- Geração de mapas dinâmicos/animados indicando a evolução anual das classes-alvo;
- Aplicação de nova camada de refatoração;
- Testes finais;
- Revisão e refinamento da documentação;
*/


// ETAPA 1 - RECURSOS INICIAIS E ÁREA DE INTERESSE

// Definição da área-alvo conforme requisito do projeto 
var geometry = ee.Geometry.Polygon([
  [
    [-58.389544224642215, -11.200339407332578],
    [-58.389544224642215, -13.336554634910579],
    [-55.906634068392215, -13.336554634910579],
    [-55.906634068392215, -11.200339407332578]
  ]
]);

// Função para criar máscara de sombra usando NDVI e SWIR
var criarMascaraSombras = function(img) {
  var ndvi = img.normalizedDifference(['B8', 'B4']);
  var sombraNDVI = ndvi.lt(0.1); // valores baixos de NDVI (indicativos de sombra)
  var swir = img.select('B11');
  var sombraSWIR = swir.lt(1000); // valores baixos de SWIR (indicativos de sombra)
  var mascaraSombras = sombraNDVI.and(sombraSWIR);
  return img.updateMask(mascaraSombras.not()); // Máscara invertida para a remoção e update
};

// Função para remover nuvens e sombras
var removerNuvensESombras = function(img){
  var qa = img.select('QA60'); // Banda de nuvens
  var mascaraNuvens = qa.eq(0);
  img = criarMascaraSombras(img); // Aplicação da máscara de sombras
  return img.updateMask(mascaraNuvens); // Aplicação da máscara de nuvens
};

/* OBSERVAÇÃO
Inicialmente, com base nos requisitos do problema, a coleção mais apropriada para esta análise seria a ‘S2_SR_HARMONIZED’. 
Ela traz dados de reflectância da superfície (Surface Reflectance), e não do topo da atmosfera (TOA) como as coleções ‘SR’ e ‘SR_HARMONIZED’. 
Porém não se tem disponíveis os dados de 2017 para ‘S2_SR_HARMONIZED’.

Usar ‘S2’ para 2017 e ‘S2_SR’ para 2023 não é uma solução adequada, pois os dois satélites 2A e 2B, apesar de parecidos, têm diferentes calibragens radiométricas. 
Portanto, as imagens não seriam consistentes ao comparar-se uma com a outra.

A solução escolhida para este cenário prioriza a CONSISTÊNCIA dos dados, visando garantir que o classificador Random Forest funcione de maneira precisa e confiável. 
Optou-se pela utilização da coleção ‘S2_HARMONIZED’ para 2017 e para 2023, executando todos os tratamentos cabíveis para “correção” os efeitos da atmosfera (nuvens, sombra, aerossois e outros).  
A 'S2_HARMONIZED' possui a banda QA60 para o período, facilitando o pré-processamento. 

Além da correção de nuvens e sombra, considerou-se ainda a viabilidade de outras possibilidades, como aplicação do método 6S, DOS, SCC e o tratamento externo via Sen2Cor por exemplo. 
A aplicação de SIAC consumiu muitos recursos computacionais, ao mesmo tempo que o ideal seria ainda sua aplicação a cada imagem que geraria o mosaico.
Assim, optou-se por uma abordagem mais objetiva e compatível com o problema de classificação
*/

// Função para criar mosaico com input do ano desejado
var criarMosaico = function(ano, geometry) {
  var dataInicio = ano + '-01-01';
  var dataFim = ano + '-12-31';
  var S2 = ee.ImageCollection("COPERNICUS/S2_HARMONIZED")
               .filterBounds(geometry)
               .filterDate(dataInicio, dataFim)
               .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 5)) // Homogeneizar imagens com poucas nuvens
               .map(removerNuvensESombras)
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
