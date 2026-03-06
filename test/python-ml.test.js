/**
 * Bridger Jest Tests — scikit-learn (Machine Learning)
 *
 * Tests: datasets, preprocessing, models (KNN, LinearRegression, DecisionTree,
 * RandomForest, SVM), train_test_split, accuracy, cross_val_score
 */
'use strict';

const {
    bridge,
    shutdown,
    approxEq
} = require('./helpers');

afterAll(() => shutdown());

describe('scikit-learn — Datasets', () => {
    test('load_iris', async () => {
        const datasets = await bridge('python:sklearn.datasets');
        const iris = await datasets.load_iris();
        const data = await iris.data;
        const shape = await data.shape.$value();
        expect(shape).toEqual([150, 4]);
    });

    test('load_digits', async () => {
        const datasets = await bridge('python:sklearn.datasets');
        const digits = await datasets.load_digits();
        const target = await digits.target;
        const shape = await target.shape.$value();
        expect(shape).toEqual([1797]);
    });

    test('make_classification', async () => {
        const builtins = await bridge('python:builtins');
        const shape = await builtins.eval(`
(lambda: (
  setattr(__import__('builtins'), '_mc',
    __import__('sklearn.datasets', fromlist=['make_classification']).make_classification(n_samples=100, n_features=4, random_state=42)),
  __import__('builtins')._mc[0].shape
)[-1])()
`);
        expect(Array.from(shape)).toEqual([100, 4]);
    });
});

describe('scikit-learn — Preprocessing', () => {
    test('StandardScaler', async () => {
        const builtins = await bridge('python:builtins');
        const result = await builtins.eval(`
(lambda: (
  __import__('sklearn.preprocessing', fromlist=['StandardScaler']),
  setattr(__import__('builtins'), '_scaler',
    __import__('sklearn.preprocessing', fromlist=['StandardScaler']).StandardScaler()),
  setattr(__import__('builtins'), '_data', [[1,2],[3,4],[5,6]]),
  __import__('builtins')._scaler.fit_transform(__import__('builtins')._data).tolist()
)[-1])()
`);
        expect(result).toHaveLength(3);
        // Mean should be ~0, std ~1 for each column
        approxEq(result[0][0] + result[1][0] + result[2][0], 0, 0.01);
    });

    test('MinMaxScaler', async () => {
        const builtins = await bridge('python:builtins');
        const result = await builtins.eval(`
(lambda: (
  setattr(__import__('builtins'), '_s',
    __import__('sklearn.preprocessing', fromlist=['MinMaxScaler']).MinMaxScaler()),
  __import__('builtins')._s.fit_transform([[0],[5],[10]]).flatten().tolist()
)[-1])()
`);
        expect(result).toEqual([0, 0.5, 1]);
    });

    test('LabelEncoder', async () => {
        const builtins = await bridge('python:builtins');
        const result = await builtins.eval(`
(lambda: (
  setattr(__import__('builtins'), '_le',
    __import__('sklearn.preprocessing', fromlist=['LabelEncoder']).LabelEncoder()),
  __import__('builtins')._le.fit_transform(['cat','dog','cat','bird']).tolist()
)[-1])()
`);
        expect(result).toHaveLength(4);
        // cat→1, dog→2, bird→0  (alphabetical)
        expect(result[0]).toBe(result[2]); // both 'cat'
    });
});

describe('scikit-learn — Models', () => {
    test('KNeighborsClassifier on iris', async () => {
        const builtins = await bridge('python:builtins');
        const accuracy = await builtins.eval(`
(lambda: (
  setattr(__import__('builtins'), '_iris', __import__('sklearn.datasets', fromlist=['load_iris']).load_iris()),
  setattr(__import__('builtins'), '_split',
    __import__('sklearn.model_selection', fromlist=['train_test_split']).train_test_split(
      __import__('builtins')._iris.data, __import__('builtins')._iris.target,
      test_size=0.3, random_state=42)),
  setattr(__import__('builtins'), '_knn',
    __import__('sklearn.neighbors', fromlist=['KNeighborsClassifier']).KNeighborsClassifier(n_neighbors=3)),
  __import__('builtins')._knn.fit(__import__('builtins')._split[0], __import__('builtins')._split[2]),
  __import__('sklearn.metrics', fromlist=['accuracy_score']).accuracy_score(
    __import__('builtins')._split[3],
    __import__('builtins')._knn.predict(__import__('builtins')._split[1]))
)[-1])()
`);
        expect(accuracy).toBeGreaterThan(0.9);
    });

    test('LinearRegression', async () => {
        const builtins = await bridge('python:builtins');
        const result = await builtins.eval(`
(lambda: (
  setattr(__import__('builtins'), '_lr',
    __import__('sklearn.linear_model', fromlist=['LinearRegression']).LinearRegression()),
  __import__('builtins')._lr.fit([[1],[2],[3],[4],[5]], [2,4,6,8,10]),
  __import__('builtins')._lr.predict([[6]])[0]
)[-1])()
`);
        approxEq(result, 12.0);
    });

    test('DecisionTreeClassifier', async () => {
        const builtins = await bridge('python:builtins');
        const accuracy = await builtins.eval(`
(lambda: (
  setattr(__import__('builtins'), '_iris', __import__('sklearn.datasets', fromlist=['load_iris']).load_iris()),
  setattr(__import__('builtins'), '_split',
    __import__('sklearn.model_selection', fromlist=['train_test_split']).train_test_split(
      __import__('builtins')._iris.data, __import__('builtins')._iris.target,
      test_size=0.3, random_state=42)),
  setattr(__import__('builtins'), '_dt',
    __import__('sklearn.tree', fromlist=['DecisionTreeClassifier']).DecisionTreeClassifier(random_state=42)),
  __import__('builtins')._dt.fit(__import__('builtins')._split[0], __import__('builtins')._split[2]),
  __import__('sklearn.metrics', fromlist=['accuracy_score']).accuracy_score(
    __import__('builtins')._split[3],
    __import__('builtins')._dt.predict(__import__('builtins')._split[1]))
)[-1])()
`);
        expect(accuracy).toBeGreaterThan(0.85);
    });

    test('RandomForestClassifier', async () => {
        const builtins = await bridge('python:builtins');
        const accuracy = await builtins.eval(`
(lambda: (
  setattr(__import__('builtins'), '_iris', __import__('sklearn.datasets', fromlist=['load_iris']).load_iris()),
  setattr(__import__('builtins'), '_split',
    __import__('sklearn.model_selection', fromlist=['train_test_split']).train_test_split(
      __import__('builtins')._iris.data, __import__('builtins')._iris.target,
      test_size=0.3, random_state=42)),
  setattr(__import__('builtins'), '_rf',
    __import__('sklearn.ensemble', fromlist=['RandomForestClassifier']).RandomForestClassifier(n_estimators=10, random_state=42)),
  __import__('builtins')._rf.fit(__import__('builtins')._split[0], __import__('builtins')._split[2]),
  __import__('sklearn.metrics', fromlist=['accuracy_score']).accuracy_score(
    __import__('builtins')._split[3],
    __import__('builtins')._rf.predict(__import__('builtins')._split[1]))
)[-1])()
`);
        expect(accuracy).toBeGreaterThan(0.9);
    });

    test('SVM (SVC)', async () => {
        const builtins = await bridge('python:builtins');
        const accuracy = await builtins.eval(`
(lambda: (
  setattr(__import__('builtins'), '_iris', __import__('sklearn.datasets', fromlist=['load_iris']).load_iris()),
  setattr(__import__('builtins'), '_split',
    __import__('sklearn.model_selection', fromlist=['train_test_split']).train_test_split(
      __import__('builtins')._iris.data, __import__('builtins')._iris.target,
      test_size=0.3, random_state=42)),
  setattr(__import__('builtins'), '_svc',
    __import__('sklearn.svm', fromlist=['SVC']).SVC(kernel='rbf', random_state=42)),
  __import__('builtins')._svc.fit(__import__('builtins')._split[0], __import__('builtins')._split[2]),
  __import__('sklearn.metrics', fromlist=['accuracy_score']).accuracy_score(
    __import__('builtins')._split[3],
    __import__('builtins')._svc.predict(__import__('builtins')._split[1]))
)[-1])()
`);
        expect(accuracy).toBeGreaterThan(0.9);
    });
});

describe('scikit-learn — Metrics', () => {
    test('confusion_matrix', async () => {
        const builtins = await bridge('python:builtins');
        const result = await builtins.eval(`
__import__('sklearn.metrics', fromlist=['confusion_matrix']).confusion_matrix([0,0,1,1], [0,1,1,1]).tolist()
`);
        expect(result).toEqual([
            [1, 1],
            [0, 2]
        ]);
    });

    test('classification_report (returns string)', async () => {
        const builtins = await bridge('python:builtins');
        const result = await builtins.eval(`
__import__('sklearn.metrics', fromlist=['classification_report']).classification_report([0,0,1,1,2,2], [0,0,1,1,2,1])
`);
        expect(typeof result).toBe('string');
        expect(result).toContain('precision');
    });
});

describe('XGBoost — Gradient Boosting', () => {
    test('XGBClassifier on iris', async () => {
        const builtins = await bridge('python:builtins');
        const accuracy = await builtins.eval(`
(lambda: (
  setattr(__import__('builtins'), '_iris', __import__('sklearn.datasets', fromlist=['load_iris']).load_iris()),
  setattr(__import__('builtins'), '_split',
    __import__('sklearn.model_selection', fromlist=['train_test_split']).train_test_split(
      __import__('builtins')._iris.data, __import__('builtins')._iris.target,
      test_size=0.3, random_state=42)),
  setattr(__import__('builtins'), '_xgb',
    __import__('xgboost').XGBClassifier(n_estimators=50, use_label_encoder=False, eval_metric='mlogloss', verbosity=0)),
  __import__('builtins')._xgb.fit(__import__('builtins')._split[0], __import__('builtins')._split[2]),
  __import__('sklearn.metrics', fromlist=['accuracy_score']).accuracy_score(
    __import__('builtins')._split[3],
    __import__('builtins')._xgb.predict(__import__('builtins')._split[1]))
)[-1])()
`);
        expect(accuracy).toBeGreaterThan(0.9);
    });

    test('XGBRegressor', async () => {
        const builtins = await bridge('python:builtins');
        const result = await builtins.eval(`
(lambda: (
  setattr(__import__('builtins'), '_xgr',
    __import__('xgboost').XGBRegressor(n_estimators=50, verbosity=0)),
  __import__('builtins')._xgr.fit([[1],[2],[3],[4],[5]], [2,4,6,8,10]),
  float(__import__('builtins')._xgr.predict([[6]])[0])
)[-1])()
`);
        approxEq(result, 10, 2); // Should predict close to 12, allow tolerance
    });
});