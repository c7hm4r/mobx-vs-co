
/* global consistentObservable mobx */

(function () {
  var coTestSet = {
    name: 'coTestSet',
    initialTestData: function () {
      return {
        recorders: [],
        currentRecorder: null,
        setCR: function (recorder) {
          this.recorders.push(this.currentRecorder);
          this.currentRecorder = recorder;
        },
        resetCR: function () {
          this.currentRecorder = this.recorders.pop();
        },
        currentTransition: null
      };
    },
    createAtom: consistentObservable.newIndependent.bind(consistentObservable),
    createDependent: function (func, testData) {
      return consistentObservable.newComputed(function (recorder) {
        testData.setCR(recorder);
        var value = func();
        testData.resetCR();
        return value;
      });
    },
    readObservable: function (atom, testData) {
      return testData.currentRecorder(atom);
    },
    peekObservable: function (atom) {
      return atom.peek();
    },
    createTracking: function (func, testData) {
      return consistentObservable.newAction(function (recorder) {
        testData.setCR(recorder);
        func();
        testData.resetCR();
      });
    },
    setObservable: function (atom, value, testData) {
      atom.set(value, testData.currentTransition);
    },
    inTransitionDo: function (action, testData) {
      consistentObservable.inTransition(function (transition) {
        testData.currentTransition = transition;
        action();
        testData.currentTransition = null;
      });
    }
  };

  var mobxTestSet = {
    name: 'mobxTestSet',
    initialTestData: function () { },
    createAtom: mobx.observable.shallowBox.bind(mobx.observable),
    createDependent: mobx.computed.bind(mobx),
    readObservable: function (observable) {
      return observable.get();
    },
    peekObservable: function (observable) {
      return observable.get();
    },
    createTracking: mobx.autorun.bind(mobx),
    setObservable: function (observable, value) {
      observable.set(value);
    },
    inTransitionDo: mobx.runInAction.bind(mobx)
  };

  function benchmark(testSet, difficulty) {
    //console.log(testSet.name);
    var start = performance.now();
    var data = testSet.initialTestData();
    var atomCount = Math.pow(2, difficulty);
    var atoms = [];
    for (var i = 0; i < atomCount; i++) {
      atoms.push(testSet.createAtom(i));
    }
    var observables = atoms;
    for (var level = 0; level < difficulty; level++) {
      (function () {
        var obss = observables;
        var nextObservables = [];
        for (var i = 0; i < Math.pow(2, difficulty - level - 1); i++) {
          (function () {
            var j = i * 2;
            nextObservables.push(testSet.createDependent(function () {
              return testSet.readObservable(obss[j], data) +
                testSet.readObservable(obss[j + 1], data);
            }, data));
          })();
        }
        observables = nextObservables;
      })();
    }
    if (observables.length !== 1) {
      throw new Error('Funktioniert nicht.');
    }
    var topObservable = observables[0];
    testSet.createTracking(function() {
      var value = testSet.readObservable(topObservable, data);
      //console.log(value);
    }, data);
    for (i = 0; i < difficulty; i++) {
      testSet.inTransitionDo(function() {
        for (var j = 0; j < Math.pow(2, i); j++) {
          var value = testSet.peekObservable(atoms[j], data);
          testSet.setObservable(atoms[j], value * 2, data);
        }
      }, data);
    }
    var duration = performance.now() - start;
    //console.log(duration + ' ms');
    return duration;
  }
  
  var maxDifficulty = 18;
  var passesCount = 8;

  function continuousBenchmarks() {
    var testSets = [coTestSet, mobxTestSet];
    var nextContinuation;

    function next() {
      if (nextContinuation !== null) {
        window.setTimeout(function() {
          nextContinuation = nextContinuation();   
          next();
        }, 0);
      }
    }

    var difficulty;
    var testSetsIndex;
    var passIndex;
    var results = window.results = [];
    var durationSum;
    var average;
    
    function fromStart() {
      difficulty = 0;
      return difficultyLoop();
    }

    function difficultyLoop() {
      for (; difficulty <= maxDifficulty; difficulty++) {
          console.log('difficulty: ' + difficulty);
          results[difficulty] = [];
          testSetsIndex = 0;
          var cont = testSetLoop();
          if (testSetLoop !== null) {
            return cont;
          }
      }
      console.log(results.map(function (diffResult) {
        return diffResult.join(';');
      }).join('\n'));
      return null;
    }

    function testSetLoop() {
      for (; testSetsIndex < testSets.length; testSetsIndex++) {
        console.log(testSets[testSetsIndex].name);
        passIndex = 0;
        durationSum = 0;
        var cont = averageLoop();
        if (cont !== null) {
          return cont;
        }
        results[difficulty][testSetsIndex] = average;
        return fromBenchmark;
      }
      return null;
    }

    function averageLoop() {
      for (; passIndex < passesCount; passIndex++) {
        durationSum += benchmark(testSets[testSetsIndex], difficulty);
        return fromBenchmark;
      }
      average = durationSum / passesCount;
      return null;
    }

    function fromBenchmark() {
      passIndex++;
      var cont = averageLoop();
      if (cont !== null) {
        return cont;
      }
      results[difficulty][testSetsIndex] = average;
      testSetsIndex++;
      cont = testSetLoop();
      if (cont !== null) {
        return cont;
      }
      difficulty++;
      return difficultyLoop();
    }

    nextContinuation = fromStart;
    next();
  }

  // for (var difficulty = 0; 1 === Math.pow(1, 1); difficulty++) {
  //   console.log('difficulty: ' + difficulty);
  //   testSets.forEach(function (testSet) {
  //     benchmark(testSet, difficulty);
  //   });
  // }

  window.setTimeout(continuousBenchmarks, 2000);
})();
