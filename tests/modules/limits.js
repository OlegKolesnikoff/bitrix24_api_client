/* eslint-disable max-lines-per-function */
/* eslint-disable no-console */
/**
 * Тесты для проверки работы лимитера запросов
 */

module.exports = {
  /* // Тест последовательных запросов с нормальной интенсивностью
  'должен успешно выполнить 5 запросов с паузами': async (api, auth, assert) => {
    for (let i = 0; i < 5; i++) {
      const result = await api.call('user.current', {}, auth);
      assert.ok(result.result, `Запрос #${i+1} не вернул результат`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  },
  
  // Тест последовательных запросов с высокой интенсивностью
  'должен успешно выполнить 100 запросов без пауз': async (api, auth, assert) => {
    const times = [];
    
    for (let i = 0; i < 100; i++) {
      const startTime = Date.now();
      const result = await api.call('user.current', {}, auth);
      const elapsed = Date.now() - startTime;
      
      times.push(elapsed);
      assert.ok(result.result, `Запрос #${i+1} не вернул результат`);
    }
    
    // Анализируем времена выполнения - в конце должны быть задержки
    const firstHalf = times.slice(0, 50);
    const secondHalf = times.slice(50);
    
    const avgFirst = firstHalf.reduce((sum, t) => sum + t, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((sum, t) => sum + t, 0) / secondHalf.length;
    
    console.log(`\n    Среднее время первых 50 запросов: ${avgFirst.toFixed(2)}ms`);
    console.log(`    Среднее время последних 50 запросов: ${avgSecond.toFixed(2)}ms`);
    
    // Проверяем, что механизм лимитов работает (вторая половина должна быть медленнее)
    assert.ok(avgSecond > avgFirst, 'Механизм лимитов не работает - запросы не замедляются');
  },
  
  // Тест восстановления после паузы
  'должен восстанавливать скорость после паузы': async (api, auth, assert) => {
    // Делаем 5 быстрых запросов для активации лимитера
    for (let i = 0; i < 5; i++) {
      await api.call('user.current', {}, auth);
    }
    
    // Делаем паузу для восстановления
    console.log('\n    Ожидание 10 секунд для восстановления...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Делаем еще 3 запроса и проверяем скорость
    const times = [];
    
    for (let i = 0; i < 3; i++) {
      const startTime = Date.now();
      await api.call('user.current', {}, auth);
      times.push(Date.now() - startTime);
    }
    
    const avgTime = times.reduce((sum, t) => sum + t, 0) / times.length;
    console.log(`    Среднее время запросов после паузы: ${avgTime.toFixed(2)}ms`);
    
    // Проверяем, что скорость восстановилась (запросы должны быть быстрыми)
    assert.ok(avgTime < 1000, 'Скорость запросов не восстановилась после паузы');
  }, */

// Тест параллельных запросов
'должен корректно обрабатывать 100 параллельных запросов': async (api, auth, assert) => {

  console.log('\n    Запуск 100 параллельных запросов...');
  const PARALLEL_REQUESTS = 100;
  const startTime = Date.now();
  
  // Создаем массив промисов для параллельного выполнения
  const promises = [];
  const results = [];
  
  // Создаем все запросы сразу в массиве
  const requests = Array.from({ length: PARALLEL_REQUESTS }, (_, i) => ({ index: i }));

  // Запускаем их с минимальной задержкой для одновременного добавления в очередь
  for (const req of requests) {
    const requestStart = Date.now();
    const promise = api.call('user.current', {}, auth)
      .then(result => ({
        index: req.index, 
        success: true, 
        result,
        duration: Date.now() - requestStart,
        startedAt: requestStart - startTime
      }))
      .catch(error => ({
        index: req.index, 
        success: false, 
        error: error.message,
        duration: Date.now() - requestStart,
        startedAt: requestStart - startTime
      }));
    
    promises.push(promise);
    
    // Минимальная задержка, чтобы не блокировать цикл событий
    await new Promise(resolve => setTimeout(resolve, 5));
  }
  
  // Ожидаем завершения всех запросов
  const allResults = await Promise.all(promises);
  const totalDuration = Date.now() - startTime;
  
  // Добавляем результаты в общий массив
  results.push(...allResults);
  
  // Сортируем результаты по времени завершения
  results.sort((a, b) => (a.startedAt + a.duration) - (b.startedAt + b.duration));
  
  // Анализируем результаты
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  const durations = successful.map(r => r.duration);
  
  // Проверяем, что массив durations не пустой и содержит числа
  const validDurations = durations.filter(d => typeof d === 'number' && !isNaN(d));
  
  const avgDuration = validDurations.length > 0 
    ? validDurations.reduce((sum, d) => sum + d, 0) / validDurations.length 
    : 0;
  
  const minDuration = validDurations.length > 0 
    ? Math.min(...validDurations) 
    : 0;
  
  const maxDuration = validDurations.length > 0 
    ? Math.max(...validDurations) 
    : 0;
  
  // Разделение на группы для анализа распределения времени
  // Добавляем проверку на пустой массив
  let firstGroup = [], secondGroup = [], thirdGroup = [], fourthGroup = [];
  let avgFirstGroup = 0, avgSecondGroup = 0, avgThirdGroup = 0, avgFourthGroup = 0;
  
  if (validDurations.length > 0) {
    firstGroup = validDurations.slice(0, Math.max(1, Math.floor(validDurations.length / 4)));
    secondGroup = validDurations.slice(Math.floor(validDurations.length / 4), Math.floor(validDurations.length / 2));
    thirdGroup = validDurations.slice(Math.floor(validDurations.length / 2), Math.floor(3 * validDurations.length / 4));
    fourthGroup = validDurations.slice(Math.floor(3 * validDurations.length / 4));
    
    avgFirstGroup = firstGroup.reduce((sum, d) => sum + d, 0) / firstGroup.length;
    avgSecondGroup = secondGroup.length > 0 ? secondGroup.reduce((sum, d) => sum + d, 0) / secondGroup.length : 0;
    avgThirdGroup = thirdGroup.length > 0 ? thirdGroup.reduce((sum, d) => sum + d, 0) / thirdGroup.length : 0;
    avgFourthGroup = fourthGroup.length > 0 ? fourthGroup.reduce((sum, d) => sum + d, 0) / fourthGroup.length : 0;
  }
  
  // Выводим результаты
  console.log(`\n    Результаты теста параллельных запросов:`);
  console.log(`    - Всего запросов: ${results.length}`);
  console.log(`    - Успешных: ${successful.length}`);
  console.log(`    - Ошибок: ${failed.length}`);
  console.log(`    - Общее время выполнения: ${totalDuration}ms`);
  console.log(`    - Среднее время запроса: ${avgDuration.toFixed(2)}ms`);
  console.log(`    - Мин. время: ${minDuration}ms`);
  console.log(`    - Макс. время: ${maxDuration}ms`);
  console.log(`\n    Распределение времени выполнения по квартилям:`);
  console.log(`    - 1-й квартиль (0-25%): ${avgFirstGroup.toFixed(2)}ms`);
  console.log(`    - 2-й квартиль (25-50%): ${avgSecondGroup.toFixed(2)}ms`);
  console.log(`    - 3-й квартиль (50-75%): ${avgThirdGroup.toFixed(2)}ms`);
  console.log(`    - 4-й квартиль (75-100%): ${avgFourthGroup.toFixed(2)}ms`);
  
  // Если были ошибки, выводим информацию о них
  if (failed.length > 0) {
    console.log(`\n    Ошибки в запросах:`);
    failed.forEach(f => {
      console.log(`    - Запрос #${f.index}: ${f.error}`);
    });
  }
  
  // Проверяем результаты с защитой от пустых массивов
  assert.ok(successful.length > 0, 'Ни один запрос не выполнился успешно');
  
  if (validDurations.length > 0) {
    // Проверяем рост времени выполнения только если у нас есть данные для всех квартилей
    if (firstGroup.length > 0 && fourthGroup.length > 0) {
      assert.ok(avgFourthGroup > avgFirstGroup, 'Нет нарастания времени выполнения - очередь работает некорректно');
    }
    
    // Проверяем общее время выполнения
    assert.ok(totalDuration > (300 * PARALLEL_REQUESTS / 10), 'Запросы выполнились слишком быстро, лимитирование не работает');
  }
  
  // Проверяем, что все запросы успешны, если были ошибки, то они должны быть связаны с лимитами
  if (failed.length > 0) {
    const limitErrors = failed.filter(f => 
      f.error.includes('limit') || 
      f.error.includes('Limit') || 
      f.error.includes('queue') || 
      f.error.includes('Queue')
    );
    assert.strictEqual(limitErrors.length, failed.length, 'Обнаружены ошибки, не связанные с лимитами');
  }
}
};
