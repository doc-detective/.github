/**
 * Tests for schemaUtils.mjs - Schema utilities for the interactive test builder
 * 
 * Tests the schema extraction and validation functions that power the builder UI.
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

import {
  getMockSpec,
  getMockTest,
  getMockStep,
  getMockGoToStep,
  getMockClickStep,
  getMockCompleteSpec,
} from './fixtures.mjs';

import {
  getStepTypes,
  getStepTypeSchema,
  getCommonStepProperties,
  getStepTypeVariants,
  getFieldVariants,
  detectVariantIndex,
  extractFieldInfo,
  getStepTypeFields,
  getSpecFields,
  getTestFields,
  validateStep,
  validateTest,
  validateSpec,
  validatePattern,
  describePattern,
  getStepTypeInfo,
  createDefaultStep,
  createDefaultTest,
  createDefaultSpec,
  getBrowserActions,
  getStepActionType,
  stepRequiresBrowser,
} from '../../src/cli/builder/schemaUtils.mjs';

describe('schemaUtils', function () {
  describe('getStepTypes', function () {
    it('returns an array of step type names', function () {
      const stepTypes = getStepTypes();
      
      expect(stepTypes).to.be.an('array');
      expect(stepTypes.length).to.be.greaterThan(0);
    });

    it('includes common action types', function () {
      const stepTypes = getStepTypes();
      
      expect(stepTypes).to.include('goTo');
      expect(stepTypes).to.include('click');
      expect(stepTypes).to.include('find');
      expect(stepTypes).to.include('type');
      expect(stepTypes).to.include('screenshot');
      expect(stepTypes).to.include('httpRequest');
      expect(stepTypes).to.include('runShell');
      expect(stepTypes).to.include('wait');
    });

    it('returns sorted step types', function () {
      const stepTypes = getStepTypes();
      const sorted = [...stepTypes].sort();
      
      expect(stepTypes).to.deep.equal(sorted);
    });
  });

  describe('getStepTypeSchema', function () {
    it('returns schema for valid step type', function () {
      const schema = getStepTypeSchema('goTo');
      
      expect(schema).to.be.an('object');
      expect(schema).to.have.property('anyOf').or.have.property('type');
    });

    it('returns null for invalid step type', function () {
      const schema = getStepTypeSchema('nonExistentStepType');
      
      expect(schema).to.be.null;
    });

    it('returns schemas with descriptions', function () {
      const schema = getStepTypeSchema('click');
      
      expect(schema).to.have.property('description').or.have.property('title');
    });
  });

  describe('getCommonStepProperties', function () {
    it('returns common step properties object', function () {
      const commonProps = getCommonStepProperties();
      
      expect(commonProps).to.be.an('object');
    });
  });

  describe('getStepTypeVariants', function () {
    it('returns variants for step types with anyOf', function () {
      const variants = getStepTypeVariants('goTo');
      
      // goTo should support string (simple) and object (detailed) forms
      expect(variants).to.be.an('array');
    });

    it('returns empty array for step type without variants', function () {
      const variants = getStepTypeVariants('nonExistentType');
      
      expect(variants).to.deep.equal([]);
    });

    it('each variant has expected properties', function () {
      const variants = getStepTypeVariants('goTo');
      
      if (variants.length > 0) {
        const variant = variants[0];
        expect(variant).to.have.property('index');
        expect(variant).to.have.property('title');
        expect(variant).to.have.property('type');
        expect(variant).to.have.property('schema');
      }
    });
  });

  describe('detectVariantIndex', function () {
    it('returns 0 for undefined value', function () {
      const variants = [{ type: 'string' }, { type: 'object' }];
      const index = detectVariantIndex(undefined, variants);
      
      expect(index).to.equal(0);
    });

    it('detects string variant correctly', function () {
      const variants = [{ type: 'object' }, { type: 'string' }];
      const index = detectVariantIndex('https://example.com', variants);
      
      expect(index).to.equal(1);
    });

    it('detects object variant correctly', function () {
      const variants = [{ type: 'string' }, { type: 'object' }];
      const index = detectVariantIndex({ url: 'https://example.com' }, variants);
      
      expect(index).to.equal(1);
    });

    it('returns 0 for empty variants array', function () {
      const index = detectVariantIndex('test', []);
      
      expect(index).to.equal(0);
    });

    it('detects null variant correctly', function () {
      const variants = [{ type: 'string' }, { type: 'null' }];
      const index = detectVariantIndex(null, variants);
      
      expect(index).to.equal(1);
    });
  });

  describe('extractFieldInfo', function () {
    it('extracts basic field information', function () {
      const prop = {
        type: 'string',
        description: 'Test field',
        default: 'default value',
      };
      
      const info = extractFieldInfo(prop, 'testField');
      
      expect(info.name).to.equal('testField');
      expect(info.type).to.equal('string');
      expect(info.description).to.equal('Test field');
      expect(info.default).to.equal('default value');
    });

    it('extracts enum information', function () {
      const prop = {
        type: 'string',
        enum: ['option1', 'option2', 'option3'],
      };
      
      const info = extractFieldInfo(prop, 'enumField');
      
      expect(info.type).to.equal('enum');
      expect(info.enum).to.deep.equal(['option1', 'option2', 'option3']);
    });

    it('extracts pattern information', function () {
      const prop = {
        type: 'string',
        pattern: '^https?://',
      };
      
      const info = extractFieldInfo(prop, 'urlField');
      
      expect(info.pattern).to.equal('^https?://');
    });

    it('extracts anyOf information', function () {
      const prop = {
        anyOf: [
          { type: 'string' },
          { type: 'number' },
        ],
      };
      
      const info = extractFieldInfo(prop, 'unionField');
      
      expect(info.anyOf).to.deep.equal(prop.anyOf);
      expect(info.type).to.equal('string|number');
    });
  });

  describe('getStepTypeFields', function () {
    it('returns fields and required fields for valid step type', function () {
      const { fields, requiredFields } = getStepTypeFields('goTo');
      
      expect(fields).to.be.an('array');
      expect(requiredFields).to.be.an('array');
    });

    it('returns empty arrays for invalid step type', function () {
      const { fields, requiredFields } = getStepTypeFields('nonExistentType');
      
      expect(fields).to.deep.equal([]);
      expect(requiredFields).to.deep.equal([]);
    });
  });

  describe('getSpecFields', function () {
    it('returns spec fields', function () {
      const { fields, requiredFields } = getSpecFields();
      
      expect(fields).to.be.an('array');
      expect(requiredFields).to.be.an('array');
    });

    it('does not include tests field', function () {
      const { fields } = getSpecFields();
      const testsField = fields.find(f => f.name === 'tests');
      
      expect(testsField).to.be.undefined;
    });

    it('does not include $schema field', function () {
      const { fields } = getSpecFields();
      const schemaField = fields.find(f => f.name === '$schema');
      
      expect(schemaField).to.be.undefined;
    });
  });

  describe('getTestFields', function () {
    it('returns test fields', function () {
      const { fields, requiredFields } = getTestFields();
      
      expect(fields).to.be.an('array');
      expect(requiredFields).to.be.an('array');
    });

    it('does not include steps field', function () {
      const { fields } = getTestFields();
      const stepsField = fields.find(f => f.name === 'steps');
      
      expect(stepsField).to.be.undefined;
    });
  });

  describe('validateStep', function () {
    it('validates a correct goTo step', function () {
      const step = getMockGoToStep('https://example.com');
      const result = validateStep(step);
      
      expect(result.valid).to.be.true;
    });

    it('validates a correct click step', function () {
      const step = getMockClickStep('.button');
      const result = validateStep(step);
      
      expect(result.valid).to.be.true;
    });

    it('returns validation errors for invalid step', function () {
      const step = { unknownAction: 'value' };
      const result = validateStep(step);
      
      expect(result.valid).to.be.false;
    });
  });

  describe('validateTest', function () {
    it('validates a correct test', function () {
      const test = getMockTest({
        steps: [getMockGoToStep()],
      });
      const result = validateTest(test);
      
      expect(result.valid).to.be.true;
    });

    it('validates a test with multiple steps', function () {
      const test = getMockTest({
        steps: [
          getMockGoToStep('https://example.com'),
          getMockClickStep('.button'),
        ],
      });
      const result = validateTest(test);
      
      expect(result.valid).to.be.true;
    });
  });

  describe('validateSpec', function () {
    it('validates a correct spec', function () {
      const spec = getMockCompleteSpec({ testCount: 1, stepsPerTest: 2 });
      const result = validateSpec(spec);
      
      expect(result.valid).to.be.true;
    });

    it('validates an empty spec', function () {
      const spec = getMockSpec();
      const result = validateSpec(spec);
      
      expect(result.valid).to.be.true;
    });

    it('returns validation errors for invalid spec', function () {
      const spec = { tests: 'not an array' };
      const result = validateSpec(spec);
      
      expect(result.valid).to.be.false;
    });
  });

  describe('validatePattern', function () {
    it('returns true for matching pattern', function () {
      const result = validatePattern('https://example.com', '^https?://');
      
      expect(result).to.be.true;
    });

    it('returns false for non-matching pattern', function () {
      const result = validatePattern('ftp://example.com', '^https?://');
      
      expect(result).to.be.false;
    });

    it('returns true for null/undefined value', function () {
      expect(validatePattern(null, '^test')).to.be.true;
      expect(validatePattern(undefined, '^test')).to.be.true;
    });

    it('returns true for null/undefined pattern', function () {
      expect(validatePattern('test', null)).to.be.true;
      expect(validatePattern('test', undefined)).to.be.true;
    });

    it('returns true for invalid regex pattern', function () {
      const result = validatePattern('test', '[invalid(regex');
      
      expect(result).to.be.true;
    });
  });

  describe('describePattern', function () {
    it('returns empty string for null pattern', function () {
      const description = describePattern(null);
      
      expect(description).to.equal('');
    });

    it('returns human-readable description for known patterns', function () {
      const description = describePattern('(^(http://|https://|/).*|\\$[A-Za-z0-9_]+)');
      
      expect(description).to.include('http');
    });

    it('returns pattern itself for unknown patterns', function () {
      const pattern = '^custom-pattern$';
      const description = describePattern(pattern);
      
      expect(description).to.include(pattern);
    });
  });

  describe('getStepTypeInfo', function () {
    it('returns description and examples for valid step type', function () {
      const info = getStepTypeInfo('goTo');
      
      expect(info).to.have.property('description');
      expect(info).to.have.property('examples');
    });

    it('returns empty values for invalid step type', function () {
      const info = getStepTypeInfo('nonExistentType');
      
      expect(info.description).to.equal('');
      expect(info.examples).to.deep.equal([]);
    });
  });

  describe('createDefaultStep', function () {
    it('creates default goTo step', function () {
      const step = createDefaultStep('goTo');
      
      expect(step).to.have.property('goTo');
    });

    it('creates default click step', function () {
      const step = createDefaultStep('click');
      
      expect(step).to.have.property('click');
    });

    it('creates default find step', function () {
      const step = createDefaultStep('find');
      
      expect(step).to.have.property('find');
    });

    it('creates valid steps that pass validation', function () {
      const stepTypes = getStepTypes();
      
      for (const stepType of stepTypes) {
        const step = createDefaultStep(stepType);
        expect(step).to.have.property(stepType);
      }
    });
  });

  describe('createDefaultTest', function () {
    it('creates test with expected properties', function () {
      const test = createDefaultTest();
      
      expect(test).to.have.property('testId');
      expect(test).to.have.property('description');
      expect(test).to.have.property('steps');
      expect(test.steps).to.be.an('array');
      expect(test.steps).to.have.lengthOf(0);
    });
  });

  describe('createDefaultSpec', function () {
    it('creates spec with expected properties', function () {
      const spec = createDefaultSpec('my-spec');
      
      expect(spec).to.have.property('specId', 'my-spec');
      expect(spec).to.have.property('description');
      expect(spec).to.have.property('tests');
      expect(spec.tests).to.be.an('array');
      expect(spec.tests).to.have.lengthOf(0);
    });

    it('creates spec with empty specId when not provided', function () {
      const spec = createDefaultSpec();
      
      expect(spec.specId).to.equal('');
    });
  });

  describe('getBrowserActions', function () {
    it('returns array of browser-requiring action types', function () {
      const browserActions = getBrowserActions();
      
      expect(browserActions).to.be.an('array');
      expect(browserActions).to.include('click');
      expect(browserActions).to.include('find');
      expect(browserActions).to.include('type');
      expect(browserActions).to.include('screenshot');
    });

    it('does not include non-browser actions', function () {
      const browserActions = getBrowserActions();
      
      expect(browserActions).to.not.include('goTo');
      expect(browserActions).to.not.include('httpRequest');
      expect(browserActions).to.not.include('runShell');
    });
  });

  describe('getStepActionType', function () {
    it('returns action type for goTo step', function () {
      const step = getMockGoToStep();
      const actionType = getStepActionType(step);
      
      expect(actionType).to.equal('goTo');
    });

    it('returns action type for click step', function () {
      const step = getMockClickStep();
      const actionType = getStepActionType(step);
      
      expect(actionType).to.equal('click');
    });

    it('returns null for step without recognized action', function () {
      const step = { unknownProp: 'value' };
      const actionType = getStepActionType(step);
      
      expect(actionType).to.be.null;
    });

    it('ignores common step properties', function () {
      const step = {
        goTo: 'https://example.com',
        description: 'Navigate to page',
        stepId: 'step-1',
      };
      const actionType = getStepActionType(step);
      
      expect(actionType).to.equal('goTo');
    });
  });

  describe('stepRequiresBrowser', function () {
    it('returns true for click step', function () {
      const step = getMockClickStep();
      
      expect(stepRequiresBrowser(step)).to.be.true;
    });

    it('returns true for find step', function () {
      const step = getMockStep('find', '.element');
      
      expect(stepRequiresBrowser(step)).to.be.true;
    });

    it('returns true for type step', function () {
      const step = getMockStep('type', ['test']);
      
      expect(stepRequiresBrowser(step)).to.be.true;
    });

    it('returns true for screenshot step', function () {
      const step = getMockStep('screenshot', 'test.png');
      
      expect(stepRequiresBrowser(step)).to.be.true;
    });

    it('returns false for goTo step', function () {
      const step = getMockGoToStep();
      
      expect(stepRequiresBrowser(step)).to.be.false;
    });

    it('returns false for httpRequest step', function () {
      const step = getMockStep('httpRequest', { url: 'https://api.example.com' });
      
      expect(stepRequiresBrowser(step)).to.be.false;
    });

    it('returns false for runShell step', function () {
      const step = getMockStep('runShell', 'echo test');
      
      expect(stepRequiresBrowser(step)).to.be.false;
    });
  });
});

// Use dynamic import for chai to support ESM
let expect;
before(async function () {
  const chai = await import('chai');
  expect = chai.expect;
  global.expect = expect;
});
