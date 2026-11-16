// Generated from spec/main.tsp by scripts/generate.mjs. Do not edit.
const validators = (function () {
  "use strict";
  const hasOwn = Function.prototype.call.bind(Object.prototype.hasOwnProperty);
  const pattern0 = new RegExp("\\S", "u");
  const ref2 = function validate(data) {
    validate.errors = null;
    if (!(typeof data === "string")) {
      validate.errors = [{ keywordLocation: "#/type", instanceLocation: "#" }];
      return false;
    }
    if (!pattern0.test(data)) {
      validate.errors = [{ keywordLocation: "#/pattern", instanceLocation: "#" }];
      return false;
    }
    return true;
  };
  const errorMerge = ({ keywordLocation, instanceLocation }, schemaBase, dataBase) => ({
    keywordLocation: `${schemaBase}${keywordLocation.slice(1)}`,
    instanceLocation: `${dataBase}${instanceLocation.slice(1)}`,
  });
  const ref1 = function validate(data) {
    validate.errors = null;
    if (!(typeof data === "object" && data && !Array.isArray(data))) {
      validate.errors = [{ keywordLocation: "#/type", instanceLocation: "#" }];
      return false;
    }
    if (!("kind" in data && hasOwn(data, "kind"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/kind" }];
      return false;
    }
    if (!("type" in data && hasOwn(data, "type"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/type" }];
      return false;
    }
    if (!("id" in data && hasOwn(data, "id"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/id" }];
      return false;
    }
    if (!(typeof data.kind === "string")) {
      validate.errors = [{ keywordLocation: "#/properties/kind/type", instanceLocation: "#/kind" }];
      return false;
    }
    if (!(data.kind === "entity")) {
      validate.errors = [
        { keywordLocation: "#/properties/kind/const", instanceLocation: "#/kind" },
      ];
      return false;
    }
    const err0 = validate.errors;
    const res0 = ref2(data.type);
    const suberr0 = ref2.errors;
    validate.errors = err0;
    if (!res0) {
      validate.errors = [errorMerge(suberr0[0], "#/properties/type/$ref", "#/type")];
      return false;
    }
    if (!(typeof data.id === "string")) {
      validate.errors = [{ keywordLocation: "#/properties/id/type", instanceLocation: "#/id" }];
      return false;
    }
    return true;
  };
  const ref0 = function validate(data) {
    validate.errors = null;
    const err1 = validate.errors;
    const res1 = ref1(data);
    const suberr1 = ref1.errors;
    validate.errors = err1;
    if (!res1) {
      validate.errors = [errorMerge(suberr1[0], "#/$ref", "#")];
      return false;
    }
    return true;
  };
  const ref3 = function validate(data) {
    validate.errors = null;
    const err2 = validate.errors;
    const res2 = ref2(data);
    const suberr2 = ref2.errors;
    validate.errors = err2;
    if (!res2) {
      validate.errors = [errorMerge(suberr2[0], "#/$ref", "#")];
      return false;
    }
    return true;
  };
  const ref6 = function validate(data) {
    validate.errors = null;
    if (!(typeof data === "string")) {
      validate.errors = [{ keywordLocation: "#/type", instanceLocation: "#" }];
      return false;
    }
    if (!(data === "Infinity" || data === "-Infinity")) {
      validate.errors = [{ keywordLocation: "#/enum", instanceLocation: "#" }];
      return false;
    }
    return true;
  };
  const ref5 = function validate(data) {
    validate.errors = null;
    if (!(typeof data === "object" && data && !Array.isArray(data))) {
      validate.errors = [{ keywordLocation: "#/type", instanceLocation: "#" }];
      return false;
    }
    if (!("kind" in data && hasOwn(data, "kind"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/kind" }];
      return false;
    }
    if (!("value" in data && hasOwn(data, "value"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/value" }];
      return false;
    }
    if (!(typeof data.kind === "string")) {
      validate.errors = [{ keywordLocation: "#/properties/kind/type", instanceLocation: "#/kind" }];
      return false;
    }
    if (!(data.kind === "number")) {
      validate.errors = [
        { keywordLocation: "#/properties/kind/const", instanceLocation: "#/kind" },
      ];
      return false;
    }
    const err3 = validate.errors;
    const res3 = ref6(data.value);
    const suberr3 = ref6.errors;
    validate.errors = err3;
    if (!res3) {
      validate.errors = [errorMerge(suberr3[0], "#/properties/value/$ref", "#/value")];
      return false;
    }
    return true;
  };
  const ref4 = function validate(data) {
    validate.errors = null;
    const err4 = validate.errors;
    const res4 = ref5(data);
    const suberr4 = ref5.errors;
    validate.errors = err4;
    if (!res4) {
      validate.errors = [errorMerge(suberr4[0], "#/$ref", "#")];
      return false;
    }
    return true;
  };
  const ref7 = function validate(data) {
    validate.errors = null;
    const err5 = validate.errors;
    const res5 = ref6(data);
    const suberr5 = ref6.errors;
    validate.errors = err5;
    if (!res5) {
      validate.errors = [errorMerge(suberr5[0], "#/$ref", "#")];
      return false;
    }
    return true;
  };
  const pattern1 = new RegExp(
    "^(\\d{4}|[+-]\\d{6})-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$",
    "u",
  );
  const ref9 = function validate(data) {
    validate.errors = null;
    if (!(typeof data === "object" && data && !Array.isArray(data))) {
      validate.errors = [{ keywordLocation: "#/type", instanceLocation: "#" }];
      return false;
    }
    if (!("kind" in data && hasOwn(data, "kind"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/kind" }];
      return false;
    }
    if (!("value" in data && hasOwn(data, "value"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/value" }];
      return false;
    }
    if (!(typeof data.kind === "string")) {
      validate.errors = [{ keywordLocation: "#/properties/kind/type", instanceLocation: "#/kind" }];
      return false;
    }
    if (!(data.kind === "date")) {
      validate.errors = [
        { keywordLocation: "#/properties/kind/const", instanceLocation: "#/kind" },
      ];
      return false;
    }
    if (!(typeof data.value === "string")) {
      validate.errors = [
        { keywordLocation: "#/properties/value/type", instanceLocation: "#/value" },
      ];
      return false;
    }
    if (!pattern1.test(data.value)) {
      validate.errors = [
        { keywordLocation: "#/properties/value/pattern", instanceLocation: "#/value" },
      ];
      return false;
    }
    return true;
  };
  const ref8 = function validate(data) {
    validate.errors = null;
    const err6 = validate.errors;
    const res6 = ref9(data);
    const suberr6 = ref9.errors;
    validate.errors = err6;
    if (!res6) {
      validate.errors = [errorMerge(suberr6[0], "#/$ref", "#")];
      return false;
    }
    return true;
  };
  const ref11 = function validate(data) {
    validate.errors = null;
    if (!(typeof data === "object" && data && !Array.isArray(data))) {
      validate.errors = [{ keywordLocation: "#/type", instanceLocation: "#" }];
      return false;
    }
    if (!("kind" in data && hasOwn(data, "kind"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/kind" }];
      return false;
    }
    if (!("name" in data && hasOwn(data, "name"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/name" }];
      return false;
    }
    if (!(typeof data.kind === "string")) {
      validate.errors = [{ keywordLocation: "#/properties/kind/type", instanceLocation: "#/kind" }];
      return false;
    }
    if (!(data.kind === "var")) {
      validate.errors = [
        { keywordLocation: "#/properties/kind/const", instanceLocation: "#/kind" },
      ];
      return false;
    }
    const err7 = validate.errors;
    const res7 = ref2(data.name);
    const suberr7 = ref2.errors;
    validate.errors = err7;
    if (!res7) {
      validate.errors = [errorMerge(suberr7[0], "#/properties/name/$ref", "#/name")];
      return false;
    }
    return true;
  };
  const ref10 = function validate(data) {
    validate.errors = null;
    const err8 = validate.errors;
    const res8 = ref11(data);
    const suberr8 = ref11.errors;
    validate.errors = err8;
    if (!res8) {
      validate.errors = [errorMerge(suberr8[0], "#/$ref", "#")];
      return false;
    }
    return true;
  };
  const ref16 = function validate(data) {
    validate.errors = null;
    let passes1 = 0;
    const sub1 = (() => {
      if (!(typeof data === "string")) return false;
      return true;
    })();
    if (sub1) passes1++;
    const sub2 = (() => {
      if (!(typeof data === "number")) return false;
      return true;
    })();
    if (sub2) passes1++;
    const sub3 = (() => {
      if (!(typeof data === "boolean")) return false;
      return true;
    })();
    if (sub3) passes1++;
    const sub4 = (() => {
      const err10 = validate.errors;
      const res10 = ref5(data);
      const suberr10 = ref5.errors;
      validate.errors = err10;
      if (!res10) return false;
      return true;
    })();
    if (sub4) passes1++;
    const sub5 = (() => {
      const err11 = validate.errors;
      const res11 = ref9(data);
      const suberr11 = ref9.errors;
      validate.errors = err11;
      if (!res11) return false;
      return true;
    })();
    if (sub5) passes1++;
    const sub6 = (() => {
      const err12 = validate.errors;
      const res12 = ref1(data);
      const suberr12 = ref1.errors;
      validate.errors = err12;
      if (!res12) return false;
      return true;
    })();
    if (sub6) passes1++;
    if (passes1 !== 1) {
      validate.errors = [{ keywordLocation: "#/oneOf", instanceLocation: "#" }];
      return false;
    }
    return true;
  };
  const ref15 = function validate(data) {
    validate.errors = null;
    let passes0 = 0;
    const sub0 = (() => {
      const err13 = validate.errors;
      const res13 = ref16(data);
      const suberr13 = ref16.errors;
      validate.errors = err13;
      if (!res13) return false;
      return true;
    })();
    if (sub0) passes0++;
    const sub7 = (() => {
      const err14 = validate.errors;
      const res14 = ref11(data);
      const suberr14 = ref11.errors;
      validate.errors = err14;
      if (!res14) return false;
      return true;
    })();
    if (sub7) passes0++;
    if (passes0 !== 1) {
      validate.errors = [{ keywordLocation: "#/oneOf", instanceLocation: "#" }];
      return false;
    }
    return true;
  };
  const pointerPart = (s) => (/~\//.test(s) ? `${s}`.replace(/~/g, "~0").replace(/\//g, "~1") : s);
  const ref14 = function validate(data) {
    validate.errors = null;
    if (!(typeof data === "object" && data && !Array.isArray(data))) {
      validate.errors = [{ keywordLocation: "#/type", instanceLocation: "#" }];
      return false;
    }
    for (const key0 of Object.keys(data)) {
      if (data[key0] !== undefined) {
        const err15 = validate.errors;
        const res15 = ref15(data[key0]);
        const suberr15 = ref15.errors;
        validate.errors = err15;
        if (!res15) {
          validate.errors = [
            errorMerge(suberr15[0], "#/unevaluatedProperties/$ref", "#/" + pointerPart(key0)),
          ];
          return false;
        }
      }
    }
    return true;
  };
  const ref13 = function validate(data) {
    validate.errors = null;
    if (!(typeof data === "object" && data && !Array.isArray(data))) {
      validate.errors = [{ keywordLocation: "#/type", instanceLocation: "#" }];
      return false;
    }
    if (!("kind" in data && hasOwn(data, "kind"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/kind" }];
      return false;
    }
    if (!("predicate" in data && hasOwn(data, "predicate"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/predicate" }];
      return false;
    }
    if (!("fields" in data && hasOwn(data, "fields"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/fields" }];
      return false;
    }
    if (!(typeof data.kind === "string")) {
      validate.errors = [{ keywordLocation: "#/properties/kind/type", instanceLocation: "#/kind" }];
      return false;
    }
    if (!(data.kind === "atom")) {
      validate.errors = [
        { keywordLocation: "#/properties/kind/const", instanceLocation: "#/kind" },
      ];
      return false;
    }
    const err9 = validate.errors;
    const res9 = ref2(data.predicate);
    const suberr9 = ref2.errors;
    validate.errors = err9;
    if (!res9) {
      validate.errors = [errorMerge(suberr9[0], "#/properties/predicate/$ref", "#/predicate")];
      return false;
    }
    const err16 = validate.errors;
    const res16 = ref14(data.fields);
    const suberr16 = ref14.errors;
    validate.errors = err16;
    if (!res16) {
      validate.errors = [errorMerge(suberr16[0], "#/properties/fields/$ref", "#/fields")];
      return false;
    }
    return true;
  };
  const ref12 = function validate(data) {
    validate.errors = null;
    const err17 = validate.errors;
    const res17 = ref13(data);
    const suberr17 = ref13.errors;
    validate.errors = err17;
    if (!res17) {
      validate.errors = [errorMerge(suberr17[0], "#/$ref", "#")];
      return false;
    }
    return true;
  };
  const ref17 = function validate(data) {
    validate.errors = null;
    const err18 = validate.errors;
    const res18 = ref15(data);
    const suberr18 = ref15.errors;
    validate.errors = err18;
    if (!res18) {
      validate.errors = [errorMerge(suberr18[0], "#/$ref", "#")];
      return false;
    }
    return true;
  };
  const ref18 = function validate(data) {
    validate.errors = null;
    const err19 = validate.errors;
    const res19 = ref16(data);
    const suberr19 = ref16.errors;
    validate.errors = err19;
    if (!res19) {
      validate.errors = [errorMerge(suberr19[0], "#/$ref", "#")];
      return false;
    }
    return true;
  };
  const ref21 = function validate(data) {
    validate.errors = null;
    if (!(typeof data === "object" && data && !Array.isArray(data))) {
      validate.errors = [{ keywordLocation: "#/type", instanceLocation: "#" }];
      return false;
    }
    for (const key1 of Object.keys(data)) {
      if (data[key1] !== undefined) {
        const err21 = validate.errors;
        const res21 = ref16(data[key1]);
        const suberr21 = ref16.errors;
        validate.errors = err21;
        if (!res21) {
          validate.errors = [
            errorMerge(suberr21[0], "#/unevaluatedProperties/$ref", "#/" + pointerPart(key1)),
          ];
          return false;
        }
      }
    }
    return true;
  };
  const ref20 = function validate(data) {
    validate.errors = null;
    if (!(typeof data === "object" && data && !Array.isArray(data))) {
      validate.errors = [{ keywordLocation: "#/type", instanceLocation: "#" }];
      return false;
    }
    if (!("kind" in data && hasOwn(data, "kind"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/kind" }];
      return false;
    }
    if (!("predicate" in data && hasOwn(data, "predicate"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/predicate" }];
      return false;
    }
    if (!("fields" in data && hasOwn(data, "fields"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/fields" }];
      return false;
    }
    if (!(typeof data.kind === "string")) {
      validate.errors = [{ keywordLocation: "#/properties/kind/type", instanceLocation: "#/kind" }];
      return false;
    }
    if (!(data.kind === "atom")) {
      validate.errors = [
        { keywordLocation: "#/properties/kind/const", instanceLocation: "#/kind" },
      ];
      return false;
    }
    const err20 = validate.errors;
    const res20 = ref2(data.predicate);
    const suberr20 = ref2.errors;
    validate.errors = err20;
    if (!res20) {
      validate.errors = [errorMerge(suberr20[0], "#/properties/predicate/$ref", "#/predicate")];
      return false;
    }
    const err22 = validate.errors;
    const res22 = ref21(data.fields);
    const suberr22 = ref21.errors;
    validate.errors = err22;
    if (!res22) {
      validate.errors = [errorMerge(suberr22[0], "#/properties/fields/$ref", "#/fields")];
      return false;
    }
    return true;
  };
  const ref19 = function validate(data) {
    validate.errors = null;
    const err23 = validate.errors;
    const res23 = ref20(data);
    const suberr23 = ref20.errors;
    validate.errors = err23;
    if (!res23) {
      validate.errors = [errorMerge(suberr23[0], "#/$ref", "#")];
      return false;
    }
    return true;
  };
  const ref24 = function validate(data) {
    validate.errors = null;
    if (!(typeof data === "object" && data && !Array.isArray(data))) {
      validate.errors = [{ keywordLocation: "#/type", instanceLocation: "#" }];
      return false;
    }
    for (const key2 of Object.keys(data)) {
      if (data[key2] !== undefined) {
        if (!(typeof data[key2] === "number")) {
          validate.errors = [
            {
              keywordLocation: "#/unevaluatedProperties/type",
              instanceLocation: "#/" + pointerPart(key2),
            },
          ];
          return false;
        }
      }
    }
    return true;
  };
  const ref27 = function validate(data) {
    validate.errors = null;
    if (!(typeof data === "object" && data && !Array.isArray(data))) {
      validate.errors = [{ keywordLocation: "#/type", instanceLocation: "#" }];
      return false;
    }
    for (const key4 of Object.keys(data)) {
      if (data[key4] !== undefined) {
        const err26 = validate.errors;
        const res26 = ref26(data[key4]);
        const suberr26 = ref26.errors;
        validate.errors = err26;
        if (!res26) {
          validate.errors = [
            errorMerge(suberr26[0], "#/unevaluatedProperties/$ref", "#/" + pointerPart(key4)),
          ];
          return false;
        }
      }
    }
    return true;
  };
  const ref26 = function validate(data) {
    validate.errors = null;
    const sub8 = (() => {
      if (!(data === null)) return false;
      return true;
    })();
    const sub9 = (() => {
      if (!(typeof data === "boolean")) return false;
      return true;
    })();
    const sub10 = (() => {
      if (!(typeof data === "number")) return false;
      return true;
    })();
    const sub11 = (() => {
      if (!(typeof data === "string")) return false;
      return true;
    })();
    const sub12 = (() => {
      if (!Array.isArray(data)) return false;
      for (let i = 0; i < data.length; i++) {
        if (i in data && hasOwn(data, i)) {
          const err25 = validate.errors;
          const res25 = validate(data[i]);
          const suberr25 = validate.errors;
          validate.errors = err25;
          if (!res25) return false;
        }
      }
      return true;
    })();
    const sub13 = (() => {
      const err27 = validate.errors;
      const res27 = ref27(data);
      const suberr27 = ref27.errors;
      validate.errors = err27;
      if (!res27) return false;
      return true;
    })();
    if (!(sub8 || sub9 || sub10 || sub11 || sub12 || sub13)) {
      validate.errors = [{ keywordLocation: "#/anyOf", instanceLocation: "#" }];
      return false;
    }
    return true;
  };
  const ref25 = function validate(data) {
    validate.errors = null;
    if (!(typeof data === "object" && data && !Array.isArray(data))) {
      validate.errors = [{ keywordLocation: "#/type", instanceLocation: "#" }];
      return false;
    }
    for (const key3 of Object.keys(data)) {
      if (data[key3] !== undefined) {
        const err28 = validate.errors;
        const res28 = ref26(data[key3]);
        const suberr28 = ref26.errors;
        validate.errors = err28;
        if (!res28) {
          validate.errors = [
            errorMerge(suberr28[0], "#/unevaluatedProperties/$ref", "#/" + pointerPart(key3)),
          ];
          return false;
        }
      }
    }
    return true;
  };
  const ref23 = function validate(data) {
    validate.errors = null;
    if (!(typeof data === "object" && data && !Array.isArray(data))) {
      validate.errors = [{ keywordLocation: "#/type", instanceLocation: "#" }];
      return false;
    }
    if ("source" in data && hasOwn(data, "source")) {
      if (!(typeof data.source === "string")) {
        validate.errors = [
          { keywordLocation: "#/properties/source/type", instanceLocation: "#/source" },
        ];
        return false;
      }
    }
    if ("citation" in data && hasOwn(data, "citation")) {
      if (!(typeof data.citation === "string")) {
        validate.errors = [
          { keywordLocation: "#/properties/citation/type", instanceLocation: "#/citation" },
        ];
        return false;
      }
    }
    if ("justification" in data && hasOwn(data, "justification")) {
      if (!(typeof data.justification === "string")) {
        validate.errors = [
          {
            keywordLocation: "#/properties/justification/type",
            instanceLocation: "#/justification",
          },
        ];
        return false;
      }
    }
    if ("scores" in data && hasOwn(data, "scores")) {
      const err24 = validate.errors;
      const res24 = ref24(data.scores);
      const suberr24 = ref24.errors;
      validate.errors = err24;
      if (!res24) {
        validate.errors = [errorMerge(suberr24[0], "#/properties/scores/$ref", "#/scores")];
        return false;
      }
    }
    if ("annotations" in data && hasOwn(data, "annotations")) {
      const err29 = validate.errors;
      const res29 = ref25(data.annotations);
      const suberr29 = ref25.errors;
      validate.errors = err29;
      if (!res29) {
        validate.errors = [
          errorMerge(suberr29[0], "#/properties/annotations/$ref", "#/annotations"),
        ];
        return false;
      }
    }
    return true;
  };
  const ref22 = function validate(data) {
    validate.errors = null;
    const err30 = validate.errors;
    const res30 = ref23(data);
    const suberr30 = ref23.errors;
    validate.errors = err30;
    if (!res30) {
      validate.errors = [errorMerge(suberr30[0], "#/$ref", "#")];
      return false;
    }
    return true;
  };
  const ref28 = function validate(data) {
    validate.errors = null;
    const err31 = validate.errors;
    const res31 = ref26(data);
    const suberr31 = ref26.errors;
    validate.errors = err31;
    if (!res31) {
      validate.errors = [errorMerge(suberr31[0], "#/$ref", "#")];
      return false;
    }
    return true;
  };
  const ref31 = function validate(data) {
    validate.errors = null;
    if (!(typeof data === "string")) {
      validate.errors = [{ keywordLocation: "#/type", instanceLocation: "#" }];
      return false;
    }
    if (!(data === "asserted" || data === "denied")) {
      validate.errors = [{ keywordLocation: "#/enum", instanceLocation: "#" }];
      return false;
    }
    return true;
  };
  const ref30 = function validate(data) {
    validate.errors = null;
    if (!(typeof data === "object" && data && !Array.isArray(data))) {
      validate.errors = [{ keywordLocation: "#/type", instanceLocation: "#" }];
      return false;
    }
    if (!("sign" in data && hasOwn(data, "sign"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/sign" }];
      return false;
    }
    if (!("atom" in data && hasOwn(data, "atom"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/atom" }];
      return false;
    }
    const err32 = validate.errors;
    const res32 = ref31(data.sign);
    const suberr32 = ref31.errors;
    validate.errors = err32;
    if (!res32) {
      validate.errors = [errorMerge(suberr32[0], "#/properties/sign/$ref", "#/sign")];
      return false;
    }
    const err33 = validate.errors;
    const res33 = ref20(data.atom);
    const suberr33 = ref20.errors;
    validate.errors = err33;
    if (!res33) {
      validate.errors = [errorMerge(suberr33[0], "#/properties/atom/$ref", "#/atom")];
      return false;
    }
    if ("metadata" in data && hasOwn(data, "metadata")) {
      const err34 = validate.errors;
      const res34 = ref23(data.metadata);
      const suberr34 = ref23.errors;
      validate.errors = err34;
      if (!res34) {
        validate.errors = [errorMerge(suberr34[0], "#/properties/metadata/$ref", "#/metadata")];
        return false;
      }
    }
    return true;
  };
  const ref29 = function validate(data) {
    validate.errors = null;
    const err35 = validate.errors;
    const res35 = ref30(data);
    const suberr35 = ref30.errors;
    validate.errors = err35;
    if (!res35) {
      validate.errors = [errorMerge(suberr35[0], "#/$ref", "#")];
      return false;
    }
    return true;
  };
  const ref32 = function validate(data) {
    validate.errors = null;
    const err36 = validate.errors;
    const res36 = ref31(data);
    const suberr36 = ref31.errors;
    validate.errors = err36;
    if (!res36) {
      validate.errors = [errorMerge(suberr36[0], "#/$ref", "#")];
      return false;
    }
    return true;
  };
  const ref35 = function validate(data) {
    validate.errors = null;
    let passes2 = 0;
    const sub14 = (() => {
      if (!(typeof data === "string")) return false;
      return true;
    })();
    if (sub14) passes2++;
    const sub15 = (() => {
      if (!(typeof data === "number")) return false;
      return true;
    })();
    if (sub15) passes2++;
    const sub16 = (() => {
      const err37 = validate.errors;
      const res37 = ref5(data);
      const suberr37 = ref5.errors;
      validate.errors = err37;
      if (!res37) return false;
      return true;
    })();
    if (sub16) passes2++;
    const sub17 = (() => {
      const err38 = validate.errors;
      const res38 = ref9(data);
      const suberr38 = ref9.errors;
      validate.errors = err38;
      if (!res38) return false;
      return true;
    })();
    if (sub17) passes2++;
    if (passes2 !== 1) {
      validate.errors = [{ keywordLocation: "#/oneOf", instanceLocation: "#" }];
      return false;
    }
    return true;
  };
  const ref34 = function validate(data) {
    validate.errors = null;
    if (!(typeof data === "object" && data && !Array.isArray(data))) {
      validate.errors = [{ keywordLocation: "#/type", instanceLocation: "#" }];
      return false;
    }
    if (!("kind" in data && hasOwn(data, "kind"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/kind" }];
      return false;
    }
    if (!("values" in data && hasOwn(data, "values"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/values" }];
      return false;
    }
    if (!(typeof data.kind === "string")) {
      validate.errors = [{ keywordLocation: "#/properties/kind/type", instanceLocation: "#/kind" }];
      return false;
    }
    if (!(data.kind === "enum")) {
      validate.errors = [
        { keywordLocation: "#/properties/kind/const", instanceLocation: "#/kind" },
      ];
      return false;
    }
    if (!Array.isArray(data.values)) {
      validate.errors = [
        { keywordLocation: "#/properties/values/type", instanceLocation: "#/values" },
      ];
      return false;
    }
    for (let j = 0; j < data.values.length; j++) {
      if (j in data.values && hasOwn(data.values, j)) {
        const err39 = validate.errors;
        const res39 = ref35(data.values[j]);
        const suberr39 = ref35.errors;
        validate.errors = err39;
        if (!res39) {
          validate.errors = [
            errorMerge(suberr39[0], "#/properties/values/items/$ref", "#/values/" + j),
          ];
          return false;
        }
      }
    }
    return true;
  };
  const ref33 = function validate(data) {
    validate.errors = null;
    const err40 = validate.errors;
    const res40 = ref34(data);
    const suberr40 = ref34.errors;
    validate.errors = err40;
    if (!res40) {
      validate.errors = [errorMerge(suberr40[0], "#/$ref", "#")];
      return false;
    }
    return true;
  };
  const ref36 = function validate(data) {
    validate.errors = null;
    const err41 = validate.errors;
    const res41 = ref35(data);
    const suberr41 = ref35.errors;
    validate.errors = err41;
    if (!res41) {
      validate.errors = [errorMerge(suberr41[0], "#/$ref", "#")];
      return false;
    }
    return true;
  };
  const ref38 = function validate(data) {
    validate.errors = null;
    if (!(typeof data === "object" && data && !Array.isArray(data))) {
      validate.errors = [{ keywordLocation: "#/type", instanceLocation: "#" }];
      return false;
    }
    if (!("kind" in data && hasOwn(data, "kind"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/kind" }];
      return false;
    }
    if (!("type" in data && hasOwn(data, "type"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/type" }];
      return false;
    }
    if (!(typeof data.kind === "string")) {
      validate.errors = [{ keywordLocation: "#/properties/kind/type", instanceLocation: "#/kind" }];
      return false;
    }
    if (!(data.kind === "entityType")) {
      validate.errors = [
        { keywordLocation: "#/properties/kind/const", instanceLocation: "#/kind" },
      ];
      return false;
    }
    const err42 = validate.errors;
    const res42 = ref2(data.type);
    const suberr42 = ref2.errors;
    validate.errors = err42;
    if (!res42) {
      validate.errors = [errorMerge(suberr42[0], "#/properties/type/$ref", "#/type")];
      return false;
    }
    return true;
  };
  const ref37 = function validate(data) {
    validate.errors = null;
    const err43 = validate.errors;
    const res43 = ref38(data);
    const suberr43 = ref38.errors;
    validate.errors = err43;
    if (!res43) {
      validate.errors = [errorMerge(suberr43[0], "#/$ref", "#")];
      return false;
    }
    return true;
  };
  const ref41 = function validate(data) {
    validate.errors = null;
    if (!(typeof data === "object" && data && !Array.isArray(data))) {
      validate.errors = [{ keywordLocation: "#/type", instanceLocation: "#" }];
      return false;
    }
    for (const key5 of Object.keys(data)) {
      if (data[key5] !== undefined) {
        if (!(typeof data[key5] === "string")) {
          validate.errors = [
            {
              keywordLocation: "#/unevaluatedProperties/type",
              instanceLocation: "#/" + pointerPart(key5),
            },
          ];
          return false;
        }
      }
    }
    return true;
  };
  const ref42 = function validate(data) {
    validate.errors = null;
    if (!(typeof data === "object" && data && !Array.isArray(data))) {
      validate.errors = [{ keywordLocation: "#/type", instanceLocation: "#" }];
      return false;
    }
    for (const key6 of Object.keys(data)) {
      if (data[key6] !== undefined) {
        const err45 = validate.errors;
        const res45 = ref26(data[key6]);
        const suberr45 = ref26.errors;
        validate.errors = err45;
        if (!res45) {
          validate.errors = [
            errorMerge(suberr45[0], "#/unevaluatedProperties/$ref", "#/" + pointerPart(key6)),
          ];
          return false;
        }
      }
    }
    return true;
  };
  const ref40 = function validate(data) {
    validate.errors = null;
    if (!(typeof data === "object" && data && !Array.isArray(data))) {
      validate.errors = [{ keywordLocation: "#/type", instanceLocation: "#" }];
      return false;
    }
    if (!("description" in data && hasOwn(data, "description"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/description" }];
      return false;
    }
    if (!(typeof data.description === "string")) {
      validate.errors = [
        { keywordLocation: "#/properties/description/type", instanceLocation: "#/description" },
      ];
      return false;
    }
    if ("instructions" in data && hasOwn(data, "instructions")) {
      if (!(typeof data.instructions === "string")) {
        validate.errors = [
          { keywordLocation: "#/properties/instructions/type", instanceLocation: "#/instructions" },
        ];
        return false;
      }
    }
    if ("parameters" in data && hasOwn(data, "parameters")) {
      const err44 = validate.errors;
      const res44 = ref41(data.parameters);
      const suberr44 = ref41.errors;
      validate.errors = err44;
      if (!res44) {
        validate.errors = [errorMerge(suberr44[0], "#/properties/parameters/$ref", "#/parameters")];
        return false;
      }
    }
    if ("annotations" in data && hasOwn(data, "annotations")) {
      const err46 = validate.errors;
      const res46 = ref42(data.annotations);
      const suberr46 = ref42.errors;
      validate.errors = err46;
      if (!res46) {
        validate.errors = [
          errorMerge(suberr46[0], "#/properties/annotations/$ref", "#/annotations"),
        ];
        return false;
      }
    }
    return true;
  };
  const ref39 = function validate(data) {
    validate.errors = null;
    const err47 = validate.errors;
    const res47 = ref40(data);
    const suberr47 = ref40.errors;
    validate.errors = err47;
    if (!res47) {
      validate.errors = [errorMerge(suberr47[0], "#/$ref", "#")];
      return false;
    }
    return true;
  };
  const ref45 = function validate(data) {
    validate.errors = null;
    if (!(typeof data === "string")) {
      validate.errors = [{ keywordLocation: "#/type", instanceLocation: "#" }];
      return false;
    }
    if (!(data === "open" || data === "closed")) {
      validate.errors = [{ keywordLocation: "#/enum", instanceLocation: "#" }];
      return false;
    }
    return true;
  };
  const ref48 = function validate(data) {
    validate.errors = null;
    if (!(typeof data === "string")) {
      validate.errors = [{ keywordLocation: "#/type", instanceLocation: "#" }];
      return false;
    }
    if (!(data === "string" || data === "number" || data === "boolean" || data === "date")) {
      validate.errors = [{ keywordLocation: "#/enum", instanceLocation: "#" }];
      return false;
    }
    return true;
  };
  const ref47 = function validate(data) {
    validate.errors = null;
    let passes3 = 0;
    const sub18 = (() => {
      const err50 = validate.errors;
      const res50 = ref48(data);
      const suberr50 = ref48.errors;
      validate.errors = err50;
      if (!res50) return false;
      return true;
    })();
    if (sub18) passes3++;
    const sub19 = (() => {
      const err51 = validate.errors;
      const res51 = ref34(data);
      const suberr51 = ref34.errors;
      validate.errors = err51;
      if (!res51) return false;
      return true;
    })();
    if (sub19) passes3++;
    const sub20 = (() => {
      const err52 = validate.errors;
      const res52 = ref38(data);
      const suberr52 = ref38.errors;
      validate.errors = err52;
      if (!res52) return false;
      return true;
    })();
    if (sub20) passes3++;
    if (passes3 !== 1) {
      validate.errors = [{ keywordLocation: "#/oneOf", instanceLocation: "#" }];
      return false;
    }
    return true;
  };
  const ref46 = function validate(data) {
    validate.errors = null;
    if (!(typeof data === "object" && data && !Array.isArray(data))) {
      validate.errors = [{ keywordLocation: "#/type", instanceLocation: "#" }];
      return false;
    }
    for (const key7 of Object.keys(data)) {
      if (data[key7] !== undefined) {
        const err53 = validate.errors;
        const res53 = ref47(data[key7]);
        const suberr53 = ref47.errors;
        validate.errors = err53;
        if (!res53) {
          validate.errors = [
            errorMerge(suberr53[0], "#/unevaluatedProperties/$ref", "#/" + pointerPart(key7)),
          ];
          return false;
        }
      }
    }
    return true;
  };
  const ref44 = function validate(data) {
    validate.errors = null;
    if (!(typeof data === "object" && data && !Array.isArray(data))) {
      validate.errors = [{ keywordLocation: "#/type", instanceLocation: "#" }];
      return false;
    }
    if (!("name" in data && hasOwn(data, "name"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/name" }];
      return false;
    }
    if (!("world" in data && hasOwn(data, "world"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/world" }];
      return false;
    }
    if (!("params" in data && hasOwn(data, "params"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/params" }];
      return false;
    }
    const err48 = validate.errors;
    const res48 = ref2(data.name);
    const suberr48 = ref2.errors;
    validate.errors = err48;
    if (!res48) {
      validate.errors = [errorMerge(suberr48[0], "#/properties/name/$ref", "#/name")];
      return false;
    }
    const err49 = validate.errors;
    const res49 = ref45(data.world);
    const suberr49 = ref45.errors;
    validate.errors = err49;
    if (!res49) {
      validate.errors = [errorMerge(suberr49[0], "#/properties/world/$ref", "#/world")];
      return false;
    }
    const err54 = validate.errors;
    const res54 = ref46(data.params);
    const suberr54 = ref46.errors;
    validate.errors = err54;
    if (!res54) {
      validate.errors = [errorMerge(suberr54[0], "#/properties/params/$ref", "#/params")];
      return false;
    }
    if ("metadata" in data && hasOwn(data, "metadata")) {
      const err55 = validate.errors;
      const res55 = ref40(data.metadata);
      const suberr55 = ref40.errors;
      validate.errors = err55;
      if (!res55) {
        validate.errors = [errorMerge(suberr55[0], "#/properties/metadata/$ref", "#/metadata")];
        return false;
      }
    }
    return true;
  };
  const ref43 = function validate(data) {
    validate.errors = null;
    const err56 = validate.errors;
    const res56 = ref44(data);
    const suberr56 = ref44.errors;
    validate.errors = err56;
    if (!res56) {
      validate.errors = [errorMerge(suberr56[0], "#/$ref", "#")];
      return false;
    }
    return true;
  };
  const ref49 = function validate(data) {
    validate.errors = null;
    const err57 = validate.errors;
    const res57 = ref45(data);
    const suberr57 = ref45.errors;
    validate.errors = err57;
    if (!res57) {
      validate.errors = [errorMerge(suberr57[0], "#/$ref", "#")];
      return false;
    }
    return true;
  };
  const ref50 = function validate(data) {
    validate.errors = null;
    const err58 = validate.errors;
    const res58 = ref47(data);
    const suberr58 = ref47.errors;
    validate.errors = err58;
    if (!res58) {
      validate.errors = [errorMerge(suberr58[0], "#/$ref", "#")];
      return false;
    }
    return true;
  };
  const ref51 = function validate(data) {
    validate.errors = null;
    const err59 = validate.errors;
    const res59 = ref48(data);
    const suberr59 = ref48.errors;
    validate.errors = err59;
    if (!res59) {
      validate.errors = [errorMerge(suberr59[0], "#/$ref", "#")];
      return false;
    }
    return true;
  };
  const ref54 = function validate(data) {
    validate.errors = null;
    if (!(typeof data === "string")) {
      validate.errors = [{ keywordLocation: "#/type", instanceLocation: "#" }];
      return false;
    }
    if (
      !(
        data === "add" ||
        data === "sub" ||
        data === "mul" ||
        data === "div" ||
        data === "daysBetween" ||
        data === "yearsBetween" ||
        data === "min" ||
        data === "max" ||
        data === "roundTo" ||
        data === "floorTo" ||
        data === "ceilTo"
      )
    ) {
      validate.errors = [{ keywordLocation: "#/enum", instanceLocation: "#" }];
      return false;
    }
    return true;
  };
  const ref57 = function validate(data) {
    validate.errors = null;
    if (!(typeof data === "string")) {
      validate.errors = [{ keywordLocation: "#/type", instanceLocation: "#" }];
      return false;
    }
    if (!(data === "sum" || data === "count")) {
      validate.errors = [{ keywordLocation: "#/enum", instanceLocation: "#" }];
      return false;
    }
    return true;
  };
  const ref59 = function validate(data) {
    validate.errors = null;
    if (!(typeof data === "object" && data && !Array.isArray(data))) {
      validate.errors = [{ keywordLocation: "#/type", instanceLocation: "#" }];
      return false;
    }
    if (!("kind" in data && hasOwn(data, "kind"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/kind" }];
      return false;
    }
    if (!("atom" in data && hasOwn(data, "atom"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/atom" }];
      return false;
    }
    if (!(typeof data.kind === "string")) {
      validate.errors = [{ keywordLocation: "#/properties/kind/type", instanceLocation: "#/kind" }];
      return false;
    }
    if (!(data.kind === "not")) {
      validate.errors = [
        { keywordLocation: "#/properties/kind/const", instanceLocation: "#/kind" },
      ];
      return false;
    }
    const err66 = validate.errors;
    const res66 = ref13(data.atom);
    const suberr66 = ref13.errors;
    validate.errors = err66;
    if (!res66) {
      validate.errors = [errorMerge(suberr66[0], "#/properties/atom/$ref", "#/atom")];
      return false;
    }
    return true;
  };
  const ref60 = function validate(data) {
    validate.errors = null;
    if (!(typeof data === "object" && data && !Array.isArray(data))) {
      validate.errors = [{ keywordLocation: "#/type", instanceLocation: "#" }];
      return false;
    }
    if (!("kind" in data && hasOwn(data, "kind"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/kind" }];
      return false;
    }
    if (!("conditions" in data && hasOwn(data, "conditions"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/conditions" }];
      return false;
    }
    if (!(data.kind === "and" || data.kind === "or")) {
      validate.errors = [{ keywordLocation: "#/properties/kind/enum", instanceLocation: "#/kind" }];
      return false;
    }
    if (!Array.isArray(data.conditions)) {
      validate.errors = [
        { keywordLocation: "#/properties/conditions/type", instanceLocation: "#/conditions" },
      ];
      return false;
    }
    for (let k = 0; k < data.conditions.length; k++) {
      if (k in data.conditions && hasOwn(data.conditions, k)) {
        const err68 = validate.errors;
        const res68 = ref58(data.conditions[k]);
        const suberr68 = ref58.errors;
        validate.errors = err68;
        if (!res68) {
          validate.errors = [
            errorMerge(suberr68[0], "#/properties/conditions/items/$ref", "#/conditions/" + k),
          ];
          return false;
        }
      }
    }
    return true;
  };
  const ref61 = function validate(data) {
    validate.errors = null;
    if (!(typeof data === "object" && data && !Array.isArray(data))) {
      validate.errors = [{ keywordLocation: "#/type", instanceLocation: "#" }];
      return false;
    }
    if (!("kind" in data && hasOwn(data, "kind"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/kind" }];
      return false;
    }
    if (!("variables" in data && hasOwn(data, "variables"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/variables" }];
      return false;
    }
    if (!("condition" in data && hasOwn(data, "condition"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/condition" }];
      return false;
    }
    if (!(typeof data.kind === "string")) {
      validate.errors = [{ keywordLocation: "#/properties/kind/type", instanceLocation: "#/kind" }];
      return false;
    }
    if (!(data.kind === "exists")) {
      validate.errors = [
        { keywordLocation: "#/properties/kind/const", instanceLocation: "#/kind" },
      ];
      return false;
    }
    if (!Array.isArray(data.variables)) {
      validate.errors = [
        { keywordLocation: "#/properties/variables/type", instanceLocation: "#/variables" },
      ];
      return false;
    }
    for (let l = 0; l < data.variables.length; l++) {
      if (l in data.variables && hasOwn(data.variables, l)) {
        const err70 = validate.errors;
        const res70 = ref11(data.variables[l]);
        const suberr70 = ref11.errors;
        validate.errors = err70;
        if (!res70) {
          validate.errors = [
            errorMerge(suberr70[0], "#/properties/variables/items/$ref", "#/variables/" + l),
          ];
          return false;
        }
      }
    }
    const err71 = validate.errors;
    const res71 = ref58(data.condition);
    const suberr71 = ref58.errors;
    validate.errors = err71;
    if (!res71) {
      validate.errors = [errorMerge(suberr71[0], "#/properties/condition/$ref", "#/condition")];
      return false;
    }
    return true;
  };
  const ref62 = function validate(data) {
    validate.errors = null;
    if (!(typeof data === "object" && data && !Array.isArray(data))) {
      validate.errors = [{ keywordLocation: "#/type", instanceLocation: "#" }];
      return false;
    }
    if (!("kind" in data && hasOwn(data, "kind"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/kind" }];
      return false;
    }
    if (!("variable" in data && hasOwn(data, "variable"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/variable" }];
      return false;
    }
    if (!("value" in data && hasOwn(data, "value"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/value" }];
      return false;
    }
    if (!("condition" in data && hasOwn(data, "condition"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/condition" }];
      return false;
    }
    if (!(typeof data.kind === "string")) {
      validate.errors = [{ keywordLocation: "#/properties/kind/type", instanceLocation: "#/kind" }];
      return false;
    }
    if (!(data.kind === "letIn")) {
      validate.errors = [
        { keywordLocation: "#/properties/kind/const", instanceLocation: "#/kind" },
      ];
      return false;
    }
    const err73 = validate.errors;
    const res73 = ref11(data.variable);
    const suberr73 = ref11.errors;
    validate.errors = err73;
    if (!res73) {
      validate.errors = [errorMerge(suberr73[0], "#/properties/variable/$ref", "#/variable")];
      return false;
    }
    const err74 = validate.errors;
    const res74 = ref55(data.value);
    const suberr74 = ref55.errors;
    validate.errors = err74;
    if (!res74) {
      validate.errors = [errorMerge(suberr74[0], "#/properties/value/$ref", "#/value")];
      return false;
    }
    const err75 = validate.errors;
    const res75 = ref58(data.condition);
    const suberr75 = ref58.errors;
    validate.errors = err75;
    if (!res75) {
      validate.errors = [errorMerge(suberr75[0], "#/properties/condition/$ref", "#/condition")];
      return false;
    }
    return true;
  };
  const ref63 = function validate(data) {
    validate.errors = null;
    if (!(typeof data === "object" && data && !Array.isArray(data))) {
      validate.errors = [{ keywordLocation: "#/type", instanceLocation: "#" }];
      return false;
    }
    if (!("kind" in data && hasOwn(data, "kind"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/kind" }];
      return false;
    }
    if (!("left" in data && hasOwn(data, "left"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/left" }];
      return false;
    }
    if (!("right" in data && hasOwn(data, "right"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/right" }];
      return false;
    }
    if (
      !(
        data.kind === "eq" ||
        data.kind === "neq" ||
        data.kind === "lt" ||
        data.kind === "lte" ||
        data.kind === "gt" ||
        data.kind === "gte"
      )
    ) {
      validate.errors = [{ keywordLocation: "#/properties/kind/enum", instanceLocation: "#/kind" }];
      return false;
    }
    const err77 = validate.errors;
    const res77 = ref55(data.left);
    const suberr77 = ref55.errors;
    validate.errors = err77;
    if (!res77) {
      validate.errors = [errorMerge(suberr77[0], "#/properties/left/$ref", "#/left")];
      return false;
    }
    const err78 = validate.errors;
    const res78 = ref55(data.right);
    const suberr78 = ref55.errors;
    validate.errors = err78;
    if (!res78) {
      validate.errors = [errorMerge(suberr78[0], "#/properties/right/$ref", "#/right")];
      return false;
    }
    return true;
  };
  const ref58 = function validate(data) {
    validate.errors = null;
    if (!(typeof data === "object" && data && !Array.isArray(data))) {
      validate.errors = [{ keywordLocation: "#/type", instanceLocation: "#" }];
      return false;
    }
    if (!("kind" in data && hasOwn(data, "kind"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/kind" }];
      return false;
    }
    switch (data.kind) {
      case "atom":
        const err65 = validate.errors;
        const res65 = ref13(data);
        const suberr65 = ref13.errors;
        validate.errors = err65;
        if (!res65) {
          validate.errors = [errorMerge(suberr65[0], "#/oneOf/0/$ref", "#")];
          return false;
        }
        break;
      case "not":
        const err67 = validate.errors;
        const res67 = ref59(data);
        const suberr67 = ref59.errors;
        validate.errors = err67;
        if (!res67) {
          validate.errors = [errorMerge(suberr67[0], "#/oneOf/1/$ref", "#")];
          return false;
        }
        break;
      case "and":
      case "or":
        const err69 = validate.errors;
        const res69 = ref60(data);
        const suberr69 = ref60.errors;
        validate.errors = err69;
        if (!res69) {
          validate.errors = [errorMerge(suberr69[0], "#/oneOf/2/$ref", "#")];
          return false;
        }
        break;
      case "exists":
        const err72 = validate.errors;
        const res72 = ref61(data);
        const suberr72 = ref61.errors;
        validate.errors = err72;
        if (!res72) {
          validate.errors = [errorMerge(suberr72[0], "#/oneOf/3/$ref", "#")];
          return false;
        }
        break;
      case "letIn":
        const err76 = validate.errors;
        const res76 = ref62(data);
        const suberr76 = ref62.errors;
        validate.errors = err76;
        if (!res76) {
          validate.errors = [errorMerge(suberr76[0], "#/oneOf/4/$ref", "#")];
          return false;
        }
        break;
      case "eq":
      case "neq":
      case "lt":
      case "lte":
      case "gt":
      case "gte":
        const err79 = validate.errors;
        const res79 = ref63(data);
        const suberr79 = ref63.errors;
        validate.errors = err79;
        if (!res79) {
          validate.errors = [errorMerge(suberr79[0], "#/oneOf/5/$ref", "#")];
          return false;
        }
        break;
      default:
        validate.errors = [{ keywordLocation: "#/oneOf", instanceLocation: "#" }];
        return false;
    }
    return true;
  };
  const ref56 = function validate(data) {
    validate.errors = null;
    if (!(typeof data === "object" && data && !Array.isArray(data))) {
      validate.errors = [{ keywordLocation: "#/type", instanceLocation: "#" }];
      return false;
    }
    if (!("kind" in data && hasOwn(data, "kind"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/kind" }];
      return false;
    }
    if (!("value" in data && hasOwn(data, "value"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/value" }];
      return false;
    }
    if (!("where" in data && hasOwn(data, "where"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/where" }];
      return false;
    }
    const err63 = validate.errors;
    const res63 = ref57(data.kind);
    const suberr63 = ref57.errors;
    validate.errors = err63;
    if (!res63) {
      validate.errors = [errorMerge(suberr63[0], "#/properties/kind/$ref", "#/kind")];
      return false;
    }
    const err64 = validate.errors;
    const res64 = ref55(data.value);
    const suberr64 = ref55.errors;
    validate.errors = err64;
    if (!res64) {
      validate.errors = [errorMerge(suberr64[0], "#/properties/value/$ref", "#/value")];
      return false;
    }
    const err80 = validate.errors;
    const res80 = ref58(data.where);
    const suberr80 = ref58.errors;
    validate.errors = err80;
    if (!res80) {
      validate.errors = [errorMerge(suberr80[0], "#/properties/where/$ref", "#/where")];
      return false;
    }
    if ("completeWhen" in data && hasOwn(data, "completeWhen")) {
      const err81 = validate.errors;
      const res81 = ref58(data.completeWhen);
      const suberr81 = ref58.errors;
      validate.errors = err81;
      if (!res81) {
        validate.errors = [
          errorMerge(suberr81[0], "#/properties/completeWhen/$ref", "#/completeWhen"),
        ];
        return false;
      }
    }
    return true;
  };
  const ref55 = function validate(data) {
    validate.errors = null;
    let passes4 = 0;
    const sub21 = (() => {
      const err61 = validate.errors;
      const res61 = ref15(data);
      const suberr61 = ref15.errors;
      validate.errors = err61;
      if (!res61) return false;
      return true;
    })();
    if (sub21) passes4++;
    const sub22 = (() => {
      const err62 = validate.errors;
      const res62 = ref53(data);
      const suberr62 = ref53.errors;
      validate.errors = err62;
      if (!res62) return false;
      return true;
    })();
    if (sub22) passes4++;
    const sub23 = (() => {
      const err82 = validate.errors;
      const res82 = ref56(data);
      const suberr82 = ref56.errors;
      validate.errors = err82;
      if (!res82) return false;
      return true;
    })();
    if (sub23) passes4++;
    if (passes4 !== 1) {
      validate.errors = [{ keywordLocation: "#/oneOf", instanceLocation: "#" }];
      return false;
    }
    return true;
  };
  const ref53 = function validate(data) {
    validate.errors = null;
    if (!(typeof data === "object" && data && !Array.isArray(data))) {
      validate.errors = [{ keywordLocation: "#/type", instanceLocation: "#" }];
      return false;
    }
    if (!("kind" in data && hasOwn(data, "kind"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/kind" }];
      return false;
    }
    if (!("left" in data && hasOwn(data, "left"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/left" }];
      return false;
    }
    if (!("right" in data && hasOwn(data, "right"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/right" }];
      return false;
    }
    const err60 = validate.errors;
    const res60 = ref54(data.kind);
    const suberr60 = ref54.errors;
    validate.errors = err60;
    if (!res60) {
      validate.errors = [errorMerge(suberr60[0], "#/properties/kind/$ref", "#/kind")];
      return false;
    }
    const err83 = validate.errors;
    const res83 = ref55(data.left);
    const suberr83 = ref55.errors;
    validate.errors = err83;
    if (!res83) {
      validate.errors = [errorMerge(suberr83[0], "#/properties/left/$ref", "#/left")];
      return false;
    }
    const err84 = validate.errors;
    const res84 = ref55(data.right);
    const suberr84 = ref55.errors;
    validate.errors = err84;
    if (!res84) {
      validate.errors = [errorMerge(suberr84[0], "#/properties/right/$ref", "#/right")];
      return false;
    }
    return true;
  };
  const ref52 = function validate(data) {
    validate.errors = null;
    const err85 = validate.errors;
    const res85 = ref53(data);
    const suberr85 = ref53.errors;
    validate.errors = err85;
    if (!res85) {
      validate.errors = [errorMerge(suberr85[0], "#/$ref", "#")];
      return false;
    }
    return true;
  };
  const ref64 = function validate(data) {
    validate.errors = null;
    const err86 = validate.errors;
    const res86 = ref54(data);
    const suberr86 = ref54.errors;
    validate.errors = err86;
    if (!res86) {
      validate.errors = [errorMerge(suberr86[0], "#/$ref", "#")];
      return false;
    }
    return true;
  };
  const ref65 = function validate(data) {
    validate.errors = null;
    const err87 = validate.errors;
    const res87 = ref55(data);
    const suberr87 = ref55.errors;
    validate.errors = err87;
    if (!res87) {
      validate.errors = [errorMerge(suberr87[0], "#/$ref", "#")];
      return false;
    }
    return true;
  };
  const ref66 = function validate(data) {
    validate.errors = null;
    const err88 = validate.errors;
    const res88 = ref56(data);
    const suberr88 = ref56.errors;
    validate.errors = err88;
    if (!res88) {
      validate.errors = [errorMerge(suberr88[0], "#/$ref", "#")];
      return false;
    }
    return true;
  };
  const ref67 = function validate(data) {
    validate.errors = null;
    const err89 = validate.errors;
    const res89 = ref57(data);
    const suberr89 = ref57.errors;
    validate.errors = err89;
    if (!res89) {
      validate.errors = [errorMerge(suberr89[0], "#/$ref", "#")];
      return false;
    }
    return true;
  };
  const ref68 = function validate(data) {
    validate.errors = null;
    const err90 = validate.errors;
    const res90 = ref58(data);
    const suberr90 = ref58.errors;
    validate.errors = err90;
    if (!res90) {
      validate.errors = [errorMerge(suberr90[0], "#/$ref", "#")];
      return false;
    }
    return true;
  };
  const ref69 = function validate(data) {
    validate.errors = null;
    const err91 = validate.errors;
    const res91 = ref59(data);
    const suberr91 = ref59.errors;
    validate.errors = err91;
    if (!res91) {
      validate.errors = [errorMerge(suberr91[0], "#/$ref", "#")];
      return false;
    }
    return true;
  };
  const ref70 = function validate(data) {
    validate.errors = null;
    const err92 = validate.errors;
    const res92 = ref60(data);
    const suberr92 = ref60.errors;
    validate.errors = err92;
    if (!res92) {
      validate.errors = [errorMerge(suberr92[0], "#/$ref", "#")];
      return false;
    }
    return true;
  };
  const ref72 = function validate(data) {
    validate.errors = null;
    if (!(typeof data === "string")) {
      validate.errors = [{ keywordLocation: "#/type", instanceLocation: "#" }];
      return false;
    }
    if (!(data === "and" || data === "or")) {
      validate.errors = [{ keywordLocation: "#/enum", instanceLocation: "#" }];
      return false;
    }
    return true;
  };
  const ref71 = function validate(data) {
    validate.errors = null;
    const err93 = validate.errors;
    const res93 = ref72(data);
    const suberr93 = ref72.errors;
    validate.errors = err93;
    if (!res93) {
      validate.errors = [errorMerge(suberr93[0], "#/$ref", "#")];
      return false;
    }
    return true;
  };
  const ref73 = function validate(data) {
    validate.errors = null;
    const err94 = validate.errors;
    const res94 = ref61(data);
    const suberr94 = ref61.errors;
    validate.errors = err94;
    if (!res94) {
      validate.errors = [errorMerge(suberr94[0], "#/$ref", "#")];
      return false;
    }
    return true;
  };
  const ref74 = function validate(data) {
    validate.errors = null;
    const err95 = validate.errors;
    const res95 = ref62(data);
    const suberr95 = ref62.errors;
    validate.errors = err95;
    if (!res95) {
      validate.errors = [errorMerge(suberr95[0], "#/$ref", "#")];
      return false;
    }
    return true;
  };
  const ref75 = function validate(data) {
    validate.errors = null;
    const err96 = validate.errors;
    const res96 = ref63(data);
    const suberr96 = ref63.errors;
    validate.errors = err96;
    if (!res96) {
      validate.errors = [errorMerge(suberr96[0], "#/$ref", "#")];
      return false;
    }
    return true;
  };
  const ref77 = function validate(data) {
    validate.errors = null;
    if (!(typeof data === "string")) {
      validate.errors = [{ keywordLocation: "#/type", instanceLocation: "#" }];
      return false;
    }
    if (
      !(
        data === "eq" ||
        data === "neq" ||
        data === "lt" ||
        data === "lte" ||
        data === "gt" ||
        data === "gte"
      )
    ) {
      validate.errors = [{ keywordLocation: "#/enum", instanceLocation: "#" }];
      return false;
    }
    return true;
  };
  const ref76 = function validate(data) {
    validate.errors = null;
    const err97 = validate.errors;
    const res97 = ref77(data);
    const suberr97 = ref77.errors;
    validate.errors = err97;
    if (!res97) {
      validate.errors = [errorMerge(suberr97[0], "#/$ref", "#")];
      return false;
    }
    return true;
  };
  const ref80 = function validate(data) {
    validate.errors = null;
    if (!(typeof data === "string")) {
      validate.errors = [{ keywordLocation: "#/type", instanceLocation: "#" }];
      return false;
    }
    if (!(data === "if" || data === "iff")) {
      validate.errors = [{ keywordLocation: "#/enum", instanceLocation: "#" }];
      return false;
    }
    return true;
  };
  const ref79 = function validate(data) {
    validate.errors = null;
    if (!(typeof data === "object" && data && !Array.isArray(data))) {
      validate.errors = [{ keywordLocation: "#/type", instanceLocation: "#" }];
      return false;
    }
    if (!("kind" in data && hasOwn(data, "kind"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/kind" }];
      return false;
    }
    if (!("head" in data && hasOwn(data, "head"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/head" }];
      return false;
    }
    if (!("body" in data && hasOwn(data, "body"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/body" }];
      return false;
    }
    const err98 = validate.errors;
    const res98 = ref80(data.kind);
    const suberr98 = ref80.errors;
    validate.errors = err98;
    if (!res98) {
      validate.errors = [errorMerge(suberr98[0], "#/properties/kind/$ref", "#/kind")];
      return false;
    }
    const err99 = validate.errors;
    const res99 = ref13(data.head);
    const suberr99 = ref13.errors;
    validate.errors = err99;
    if (!res99) {
      validate.errors = [errorMerge(suberr99[0], "#/properties/head/$ref", "#/head")];
      return false;
    }
    const err100 = validate.errors;
    const res100 = ref58(data.body);
    const suberr100 = ref58.errors;
    validate.errors = err100;
    if (!res100) {
      validate.errors = [errorMerge(suberr100[0], "#/properties/body/$ref", "#/body")];
      return false;
    }
    return true;
  };
  const ref78 = function validate(data) {
    validate.errors = null;
    const err101 = validate.errors;
    const res101 = ref79(data);
    const suberr101 = ref79.errors;
    validate.errors = err101;
    if (!res101) {
      validate.errors = [errorMerge(suberr101[0], "#/$ref", "#")];
      return false;
    }
    return true;
  };
  const ref81 = function validate(data) {
    validate.errors = null;
    const err102 = validate.errors;
    const res102 = ref80(data);
    const suberr102 = ref80.errors;
    validate.errors = err102;
    if (!res102) {
      validate.errors = [errorMerge(suberr102[0], "#/$ref", "#")];
      return false;
    }
    return true;
  };
  const ref83 = function validate(data) {
    validate.errors = null;
    if (!(typeof data === "object" && data && !Array.isArray(data))) {
      validate.errors = [{ keywordLocation: "#/type", instanceLocation: "#" }];
      return false;
    }
    if (!("predicates" in data && hasOwn(data, "predicates"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/predicates" }];
      return false;
    }
    if (!("literals" in data && hasOwn(data, "literals"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/literals" }];
      return false;
    }
    if (!("rules" in data && hasOwn(data, "rules"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/rules" }];
      return false;
    }
    if (!Array.isArray(data.predicates)) {
      validate.errors = [
        { keywordLocation: "#/properties/predicates/type", instanceLocation: "#/predicates" },
      ];
      return false;
    }
    for (let m = 0; m < data.predicates.length; m++) {
      if (m in data.predicates && hasOwn(data.predicates, m)) {
        const err103 = validate.errors;
        const res103 = ref44(data.predicates[m]);
        const suberr103 = ref44.errors;
        validate.errors = err103;
        if (!res103) {
          validate.errors = [
            errorMerge(suberr103[0], "#/properties/predicates/items/$ref", "#/predicates/" + m),
          ];
          return false;
        }
      }
    }
    if (!Array.isArray(data.literals)) {
      validate.errors = [
        { keywordLocation: "#/properties/literals/type", instanceLocation: "#/literals" },
      ];
      return false;
    }
    for (let n = 0; n < data.literals.length; n++) {
      if (n in data.literals && hasOwn(data.literals, n)) {
        const err104 = validate.errors;
        const res104 = ref30(data.literals[n]);
        const suberr104 = ref30.errors;
        validate.errors = err104;
        if (!res104) {
          validate.errors = [
            errorMerge(suberr104[0], "#/properties/literals/items/$ref", "#/literals/" + n),
          ];
          return false;
        }
      }
    }
    if (!Array.isArray(data.rules)) {
      validate.errors = [
        { keywordLocation: "#/properties/rules/type", instanceLocation: "#/rules" },
      ];
      return false;
    }
    for (let o = 0; o < data.rules.length; o++) {
      if (o in data.rules && hasOwn(data.rules, o)) {
        const err105 = validate.errors;
        const res105 = ref79(data.rules[o]);
        const suberr105 = ref79.errors;
        validate.errors = err105;
        if (!res105) {
          validate.errors = [
            errorMerge(suberr105[0], "#/properties/rules/items/$ref", "#/rules/" + o),
          ];
          return false;
        }
      }
    }
    return true;
  };
  const ref82 = function validate(data) {
    validate.errors = null;
    const err106 = validate.errors;
    const res106 = ref83(data);
    const suberr106 = ref83.errors;
    validate.errors = err106;
    if (!res106) {
      validate.errors = [errorMerge(suberr106[0], "#/$ref", "#")];
      return false;
    }
    return true;
  };
  const ref85 = function validate(data) {
    validate.errors = null;
    if (!(typeof data === "object" && data && !Array.isArray(data))) {
      validate.errors = [{ keywordLocation: "#/type", instanceLocation: "#" }];
      return false;
    }
    if (!("kind" in data && hasOwn(data, "kind"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/kind" }];
      return false;
    }
    if (!("apiVersion" in data && hasOwn(data, "apiVersion"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/apiVersion" }];
      return false;
    }
    if (!("entities" in data && hasOwn(data, "entities"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/entities" }];
      return false;
    }
    if (!("predicates" in data && hasOwn(data, "predicates"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/predicates" }];
      return false;
    }
    if (!("literals" in data && hasOwn(data, "literals"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/literals" }];
      return false;
    }
    if (!("rules" in data && hasOwn(data, "rules"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/rules" }];
      return false;
    }
    if (!(typeof data.kind === "string")) {
      validate.errors = [{ keywordLocation: "#/properties/kind/type", instanceLocation: "#/kind" }];
      return false;
    }
    if (!(data.kind === "KnowledgeBase")) {
      validate.errors = [
        { keywordLocation: "#/properties/kind/const", instanceLocation: "#/kind" },
      ];
      return false;
    }
    if (!(typeof data.apiVersion === "string")) {
      validate.errors = [
        { keywordLocation: "#/properties/apiVersion/type", instanceLocation: "#/apiVersion" },
      ];
      return false;
    }
    if (!(data.apiVersion === "factbag/v1alpha1")) {
      validate.errors = [
        { keywordLocation: "#/properties/apiVersion/const", instanceLocation: "#/apiVersion" },
      ];
      return false;
    }
    if (!Array.isArray(data.entities)) {
      validate.errors = [
        { keywordLocation: "#/properties/entities/type", instanceLocation: "#/entities" },
      ];
      return false;
    }
    for (let p = 0; p < data.entities.length; p++) {
      if (p in data.entities && hasOwn(data.entities, p)) {
        const err107 = validate.errors;
        const res107 = ref1(data.entities[p]);
        const suberr107 = ref1.errors;
        validate.errors = err107;
        if (!res107) {
          validate.errors = [
            errorMerge(suberr107[0], "#/properties/entities/items/$ref", "#/entities/" + p),
          ];
          return false;
        }
      }
    }
    if (!Array.isArray(data.predicates)) {
      validate.errors = [
        { keywordLocation: "#/properties/predicates/type", instanceLocation: "#/predicates" },
      ];
      return false;
    }
    for (let q = 0; q < data.predicates.length; q++) {
      if (q in data.predicates && hasOwn(data.predicates, q)) {
        const err108 = validate.errors;
        const res108 = ref44(data.predicates[q]);
        const suberr108 = ref44.errors;
        validate.errors = err108;
        if (!res108) {
          validate.errors = [
            errorMerge(suberr108[0], "#/properties/predicates/items/$ref", "#/predicates/" + q),
          ];
          return false;
        }
      }
    }
    if (!Array.isArray(data.literals)) {
      validate.errors = [
        { keywordLocation: "#/properties/literals/type", instanceLocation: "#/literals" },
      ];
      return false;
    }
    for (let r = 0; r < data.literals.length; r++) {
      if (r in data.literals && hasOwn(data.literals, r)) {
        const err109 = validate.errors;
        const res109 = ref30(data.literals[r]);
        const suberr109 = ref30.errors;
        validate.errors = err109;
        if (!res109) {
          validate.errors = [
            errorMerge(suberr109[0], "#/properties/literals/items/$ref", "#/literals/" + r),
          ];
          return false;
        }
      }
    }
    if (!Array.isArray(data.rules)) {
      validate.errors = [
        { keywordLocation: "#/properties/rules/type", instanceLocation: "#/rules" },
      ];
      return false;
    }
    for (let s = 0; s < data.rules.length; s++) {
      if (s in data.rules && hasOwn(data.rules, s)) {
        const err110 = validate.errors;
        const res110 = ref79(data.rules[s]);
        const suberr110 = ref79.errors;
        validate.errors = err110;
        if (!res110) {
          validate.errors = [
            errorMerge(suberr110[0], "#/properties/rules/items/$ref", "#/rules/" + s),
          ];
          return false;
        }
      }
    }
    return true;
  };
  const ref84 = function validate(data) {
    validate.errors = null;
    const err111 = validate.errors;
    const res111 = ref85(data);
    const suberr111 = ref85.errors;
    validate.errors = err111;
    if (!res111) {
      validate.errors = [errorMerge(suberr111[0], "#/$ref", "#")];
      return false;
    }
    return true;
  };
  const ref87 = function validate(data) {
    validate.errors = null;
    if (!(typeof data === "object" && data && !Array.isArray(data))) {
      validate.errors = [{ keywordLocation: "#/type", instanceLocation: "#" }];
      return false;
    }
    if (!("kind" in data && hasOwn(data, "kind"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/kind" }];
      return false;
    }
    if (!("op" in data && hasOwn(data, "op"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/op" }];
      return false;
    }
    if (!("atom" in data && hasOwn(data, "atom"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/atom" }];
      return false;
    }
    if (!(typeof data.kind === "string")) {
      validate.errors = [{ keywordLocation: "#/properties/kind/type", instanceLocation: "#/kind" }];
      return false;
    }
    if (!(data.kind === "goal")) {
      validate.errors = [
        { keywordLocation: "#/properties/kind/const", instanceLocation: "#/kind" },
      ];
      return false;
    }
    if (!(typeof data.op === "string")) {
      validate.errors = [{ keywordLocation: "#/properties/op/type", instanceLocation: "#/op" }];
      return false;
    }
    if (!(data.op === "atom")) {
      validate.errors = [{ keywordLocation: "#/properties/op/const", instanceLocation: "#/op" }];
      return false;
    }
    const err112 = validate.errors;
    const res112 = ref13(data.atom);
    const suberr112 = ref13.errors;
    validate.errors = err112;
    if (!res112) {
      validate.errors = [errorMerge(suberr112[0], "#/properties/atom/$ref", "#/atom")];
      return false;
    }
    return true;
  };
  const ref86 = function validate(data) {
    validate.errors = null;
    const err113 = validate.errors;
    const res113 = ref87(data);
    const suberr113 = ref87.errors;
    validate.errors = err113;
    if (!res113) {
      validate.errors = [errorMerge(suberr113[0], "#/$ref", "#")];
      return false;
    }
    return true;
  };
  const ref91 = function validate(data) {
    validate.errors = null;
    if (!(typeof data === "object" && data && !Array.isArray(data))) {
      validate.errors = [{ keywordLocation: "#/type", instanceLocation: "#" }];
      return false;
    }
    if (!("kind" in data && hasOwn(data, "kind"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/kind" }];
      return false;
    }
    if (!("op" in data && hasOwn(data, "op"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/op" }];
      return false;
    }
    if (!("goals" in data && hasOwn(data, "goals"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/goals" }];
      return false;
    }
    if (!(typeof data.kind === "string")) {
      validate.errors = [{ keywordLocation: "#/properties/kind/type", instanceLocation: "#/kind" }];
      return false;
    }
    if (!(data.kind === "goal")) {
      validate.errors = [
        { keywordLocation: "#/properties/kind/const", instanceLocation: "#/kind" },
      ];
      return false;
    }
    if (!(data.op === "and" || data.op === "or")) {
      validate.errors = [{ keywordLocation: "#/properties/op/enum", instanceLocation: "#/op" }];
      return false;
    }
    if (!Array.isArray(data.goals)) {
      validate.errors = [
        { keywordLocation: "#/properties/goals/type", instanceLocation: "#/goals" },
      ];
      return false;
    }
    for (let t = 0; t < data.goals.length; t++) {
      if (t in data.goals && hasOwn(data.goals, t)) {
        const err116 = validate.errors;
        const res116 = ref90(data.goals[t]);
        const suberr116 = ref90.errors;
        validate.errors = err116;
        if (!res116) {
          validate.errors = [
            errorMerge(suberr116[0], "#/properties/goals/items/$ref", "#/goals/" + t),
          ];
          return false;
        }
      }
    }
    return true;
  };
  const ref92 = function validate(data) {
    validate.errors = null;
    if (!(typeof data === "object" && data && !Array.isArray(data))) {
      validate.errors = [{ keywordLocation: "#/type", instanceLocation: "#" }];
      return false;
    }
    if (!("kind" in data && hasOwn(data, "kind"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/kind" }];
      return false;
    }
    if (!("op" in data && hasOwn(data, "op"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/op" }];
      return false;
    }
    if (!("variables" in data && hasOwn(data, "variables"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/variables" }];
      return false;
    }
    if (!("goal" in data && hasOwn(data, "goal"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/goal" }];
      return false;
    }
    if (!(typeof data.kind === "string")) {
      validate.errors = [{ keywordLocation: "#/properties/kind/type", instanceLocation: "#/kind" }];
      return false;
    }
    if (!(data.kind === "goal")) {
      validate.errors = [
        { keywordLocation: "#/properties/kind/const", instanceLocation: "#/kind" },
      ];
      return false;
    }
    if (!(typeof data.op === "string")) {
      validate.errors = [{ keywordLocation: "#/properties/op/type", instanceLocation: "#/op" }];
      return false;
    }
    if (!(data.op === "exists")) {
      validate.errors = [{ keywordLocation: "#/properties/op/const", instanceLocation: "#/op" }];
      return false;
    }
    if (!Array.isArray(data.variables)) {
      validate.errors = [
        { keywordLocation: "#/properties/variables/type", instanceLocation: "#/variables" },
      ];
      return false;
    }
    for (let u = 0; u < data.variables.length; u++) {
      if (u in data.variables && hasOwn(data.variables, u)) {
        const err118 = validate.errors;
        const res118 = ref11(data.variables[u]);
        const suberr118 = ref11.errors;
        validate.errors = err118;
        if (!res118) {
          validate.errors = [
            errorMerge(suberr118[0], "#/properties/variables/items/$ref", "#/variables/" + u),
          ];
          return false;
        }
      }
    }
    const err119 = validate.errors;
    const res119 = ref90(data.goal);
    const suberr119 = ref90.errors;
    validate.errors = err119;
    if (!res119) {
      validate.errors = [errorMerge(suberr119[0], "#/properties/goal/$ref", "#/goal")];
      return false;
    }
    return true;
  };
  const ref93 = function validate(data) {
    validate.errors = null;
    if (!(typeof data === "object" && data && !Array.isArray(data))) {
      validate.errors = [{ keywordLocation: "#/type", instanceLocation: "#" }];
      return false;
    }
    if (!("kind" in data && hasOwn(data, "kind"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/kind" }];
      return false;
    }
    if (!("op" in data && hasOwn(data, "op"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/op" }];
      return false;
    }
    if (!("variable" in data && hasOwn(data, "variable"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/variable" }];
      return false;
    }
    if (!("value" in data && hasOwn(data, "value"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/value" }];
      return false;
    }
    if (!("goal" in data && hasOwn(data, "goal"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/goal" }];
      return false;
    }
    if (!(typeof data.kind === "string")) {
      validate.errors = [{ keywordLocation: "#/properties/kind/type", instanceLocation: "#/kind" }];
      return false;
    }
    if (!(data.kind === "goal")) {
      validate.errors = [
        { keywordLocation: "#/properties/kind/const", instanceLocation: "#/kind" },
      ];
      return false;
    }
    if (!(typeof data.op === "string")) {
      validate.errors = [{ keywordLocation: "#/properties/op/type", instanceLocation: "#/op" }];
      return false;
    }
    if (!(data.op === "let")) {
      validate.errors = [{ keywordLocation: "#/properties/op/const", instanceLocation: "#/op" }];
      return false;
    }
    const err121 = validate.errors;
    const res121 = ref11(data.variable);
    const suberr121 = ref11.errors;
    validate.errors = err121;
    if (!res121) {
      validate.errors = [errorMerge(suberr121[0], "#/properties/variable/$ref", "#/variable")];
      return false;
    }
    const err122 = validate.errors;
    const res122 = ref15(data.value);
    const suberr122 = ref15.errors;
    validate.errors = err122;
    if (!res122) {
      validate.errors = [errorMerge(suberr122[0], "#/properties/value/$ref", "#/value")];
      return false;
    }
    const err123 = validate.errors;
    const res123 = ref90(data.goal);
    const suberr123 = ref90.errors;
    validate.errors = err123;
    if (!res123) {
      validate.errors = [errorMerge(suberr123[0], "#/properties/goal/$ref", "#/goal")];
      return false;
    }
    return true;
  };
  const ref94 = function validate(data) {
    validate.errors = null;
    if (!(typeof data === "object" && data && !Array.isArray(data))) {
      validate.errors = [{ keywordLocation: "#/type", instanceLocation: "#" }];
      return false;
    }
    if (!("kind" in data && hasOwn(data, "kind"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/kind" }];
      return false;
    }
    if (!("op" in data && hasOwn(data, "op"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/op" }];
      return false;
    }
    if (!("bind" in data && hasOwn(data, "bind"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/bind" }];
      return false;
    }
    if (!("left" in data && hasOwn(data, "left"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/left" }];
      return false;
    }
    if (!("right" in data && hasOwn(data, "right"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/right" }];
      return false;
    }
    if (!(typeof data.kind === "string")) {
      validate.errors = [{ keywordLocation: "#/properties/kind/type", instanceLocation: "#/kind" }];
      return false;
    }
    if (!(data.kind === "goal")) {
      validate.errors = [
        { keywordLocation: "#/properties/kind/const", instanceLocation: "#/kind" },
      ];
      return false;
    }
    if (
      !(
        data.op === "add" ||
        data.op === "sub" ||
        data.op === "mul" ||
        data.op === "div" ||
        data.op === "daysBetween" ||
        data.op === "yearsBetween" ||
        data.op === "min" ||
        data.op === "max" ||
        data.op === "roundTo" ||
        data.op === "floorTo" ||
        data.op === "ceilTo"
      )
    ) {
      validate.errors = [{ keywordLocation: "#/properties/op/enum", instanceLocation: "#/op" }];
      return false;
    }
    const err125 = validate.errors;
    const res125 = ref11(data.bind);
    const suberr125 = ref11.errors;
    validate.errors = err125;
    if (!res125) {
      validate.errors = [errorMerge(suberr125[0], "#/properties/bind/$ref", "#/bind")];
      return false;
    }
    const err126 = validate.errors;
    const res126 = ref15(data.left);
    const suberr126 = ref15.errors;
    validate.errors = err126;
    if (!res126) {
      validate.errors = [errorMerge(suberr126[0], "#/properties/left/$ref", "#/left")];
      return false;
    }
    const err127 = validate.errors;
    const res127 = ref15(data.right);
    const suberr127 = ref15.errors;
    validate.errors = err127;
    if (!res127) {
      validate.errors = [errorMerge(suberr127[0], "#/properties/right/$ref", "#/right")];
      return false;
    }
    return true;
  };
  const ref95 = function validate(data) {
    validate.errors = null;
    if (!(typeof data === "object" && data && !Array.isArray(data))) {
      validate.errors = [{ keywordLocation: "#/type", instanceLocation: "#" }];
      return false;
    }
    if (!("kind" in data && hasOwn(data, "kind"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/kind" }];
      return false;
    }
    if (!("op" in data && hasOwn(data, "op"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/op" }];
      return false;
    }
    if (!("left" in data && hasOwn(data, "left"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/left" }];
      return false;
    }
    if (!("right" in data && hasOwn(data, "right"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/right" }];
      return false;
    }
    if (!(typeof data.kind === "string")) {
      validate.errors = [{ keywordLocation: "#/properties/kind/type", instanceLocation: "#/kind" }];
      return false;
    }
    if (!(data.kind === "goal")) {
      validate.errors = [
        { keywordLocation: "#/properties/kind/const", instanceLocation: "#/kind" },
      ];
      return false;
    }
    if (
      !(
        data.op === "eq" ||
        data.op === "neq" ||
        data.op === "lt" ||
        data.op === "lte" ||
        data.op === "gt" ||
        data.op === "gte"
      )
    ) {
      validate.errors = [{ keywordLocation: "#/properties/op/enum", instanceLocation: "#/op" }];
      return false;
    }
    const err129 = validate.errors;
    const res129 = ref15(data.left);
    const suberr129 = ref15.errors;
    validate.errors = err129;
    if (!res129) {
      validate.errors = [errorMerge(suberr129[0], "#/properties/left/$ref", "#/left")];
      return false;
    }
    const err130 = validate.errors;
    const res130 = ref15(data.right);
    const suberr130 = ref15.errors;
    validate.errors = err130;
    if (!res130) {
      validate.errors = [errorMerge(suberr130[0], "#/properties/right/$ref", "#/right")];
      return false;
    }
    return true;
  };
  const ref96 = function validate(data) {
    validate.errors = null;
    if (!(typeof data === "object" && data && !Array.isArray(data))) {
      validate.errors = [{ keywordLocation: "#/type", instanceLocation: "#" }];
      return false;
    }
    if (!("kind" in data && hasOwn(data, "kind"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/kind" }];
      return false;
    }
    if (!("op" in data && hasOwn(data, "op"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/op" }];
      return false;
    }
    if (!("bind" in data && hasOwn(data, "bind"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/bind" }];
      return false;
    }
    if (!("value" in data && hasOwn(data, "value"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/value" }];
      return false;
    }
    if (!("where" in data && hasOwn(data, "where"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/where" }];
      return false;
    }
    if (!(typeof data.kind === "string")) {
      validate.errors = [{ keywordLocation: "#/properties/kind/type", instanceLocation: "#/kind" }];
      return false;
    }
    if (!(data.kind === "goal")) {
      validate.errors = [
        { keywordLocation: "#/properties/kind/const", instanceLocation: "#/kind" },
      ];
      return false;
    }
    if (!(typeof data.op === "string")) {
      validate.errors = [{ keywordLocation: "#/properties/op/type", instanceLocation: "#/op" }];
      return false;
    }
    if (!(data.op === "sum")) {
      validate.errors = [{ keywordLocation: "#/properties/op/const", instanceLocation: "#/op" }];
      return false;
    }
    const err132 = validate.errors;
    const res132 = ref11(data.bind);
    const suberr132 = ref11.errors;
    validate.errors = err132;
    if (!res132) {
      validate.errors = [errorMerge(suberr132[0], "#/properties/bind/$ref", "#/bind")];
      return false;
    }
    const err133 = validate.errors;
    const res133 = ref15(data.value);
    const suberr133 = ref15.errors;
    validate.errors = err133;
    if (!res133) {
      validate.errors = [errorMerge(suberr133[0], "#/properties/value/$ref", "#/value")];
      return false;
    }
    const err134 = validate.errors;
    const res134 = ref90(data.where);
    const suberr134 = ref90.errors;
    validate.errors = err134;
    if (!res134) {
      validate.errors = [errorMerge(suberr134[0], "#/properties/where/$ref", "#/where")];
      return false;
    }
    if ("completeWhen" in data && hasOwn(data, "completeWhen")) {
      const err135 = validate.errors;
      const res135 = ref90(data.completeWhen);
      const suberr135 = ref90.errors;
      validate.errors = err135;
      if (!res135) {
        validate.errors = [
          errorMerge(suberr135[0], "#/properties/completeWhen/$ref", "#/completeWhen"),
        ];
        return false;
      }
    }
    return true;
  };
  const ref97 = function validate(data) {
    validate.errors = null;
    if (!(typeof data === "object" && data && !Array.isArray(data))) {
      validate.errors = [{ keywordLocation: "#/type", instanceLocation: "#" }];
      return false;
    }
    if (!("kind" in data && hasOwn(data, "kind"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/kind" }];
      return false;
    }
    if (!("op" in data && hasOwn(data, "op"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/op" }];
      return false;
    }
    if (!("bind" in data && hasOwn(data, "bind"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/bind" }];
      return false;
    }
    if (!("where" in data && hasOwn(data, "where"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/where" }];
      return false;
    }
    if (!(typeof data.kind === "string")) {
      validate.errors = [{ keywordLocation: "#/properties/kind/type", instanceLocation: "#/kind" }];
      return false;
    }
    if (!(data.kind === "goal")) {
      validate.errors = [
        { keywordLocation: "#/properties/kind/const", instanceLocation: "#/kind" },
      ];
      return false;
    }
    if (!(typeof data.op === "string")) {
      validate.errors = [{ keywordLocation: "#/properties/op/type", instanceLocation: "#/op" }];
      return false;
    }
    if (!(data.op === "count")) {
      validate.errors = [{ keywordLocation: "#/properties/op/const", instanceLocation: "#/op" }];
      return false;
    }
    const err137 = validate.errors;
    const res137 = ref11(data.bind);
    const suberr137 = ref11.errors;
    validate.errors = err137;
    if (!res137) {
      validate.errors = [errorMerge(suberr137[0], "#/properties/bind/$ref", "#/bind")];
      return false;
    }
    const err138 = validate.errors;
    const res138 = ref90(data.where);
    const suberr138 = ref90.errors;
    validate.errors = err138;
    if (!res138) {
      validate.errors = [errorMerge(suberr138[0], "#/properties/where/$ref", "#/where")];
      return false;
    }
    if ("completeWhen" in data && hasOwn(data, "completeWhen")) {
      const err139 = validate.errors;
      const res139 = ref90(data.completeWhen);
      const suberr139 = ref90.errors;
      validate.errors = err139;
      if (!res139) {
        validate.errors = [
          errorMerge(suberr139[0], "#/properties/completeWhen/$ref", "#/completeWhen"),
        ];
        return false;
      }
    }
    return true;
  };
  const ref90 = function validate(data) {
    validate.errors = null;
    if (!(typeof data === "object" && data && !Array.isArray(data))) {
      validate.errors = [{ keywordLocation: "#/type", instanceLocation: "#" }];
      return false;
    }
    if (!("op" in data && hasOwn(data, "op"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/op" }];
      return false;
    }
    switch (data.op) {
      case "atom":
        const err114 = validate.errors;
        const res114 = ref87(data);
        const suberr114 = ref87.errors;
        validate.errors = err114;
        if (!res114) {
          validate.errors = [errorMerge(suberr114[0], "#/oneOf/0/$ref", "#")];
          return false;
        }
        break;
      case "not":
        const err115 = validate.errors;
        const res115 = ref89(data);
        const suberr115 = ref89.errors;
        validate.errors = err115;
        if (!res115) {
          validate.errors = [errorMerge(suberr115[0], "#/oneOf/1/$ref", "#")];
          return false;
        }
        break;
      case "and":
      case "or":
        const err117 = validate.errors;
        const res117 = ref91(data);
        const suberr117 = ref91.errors;
        validate.errors = err117;
        if (!res117) {
          validate.errors = [errorMerge(suberr117[0], "#/oneOf/2/$ref", "#")];
          return false;
        }
        break;
      case "exists":
        const err120 = validate.errors;
        const res120 = ref92(data);
        const suberr120 = ref92.errors;
        validate.errors = err120;
        if (!res120) {
          validate.errors = [errorMerge(suberr120[0], "#/oneOf/3/$ref", "#")];
          return false;
        }
        break;
      case "let":
        const err124 = validate.errors;
        const res124 = ref93(data);
        const suberr124 = ref93.errors;
        validate.errors = err124;
        if (!res124) {
          validate.errors = [errorMerge(suberr124[0], "#/oneOf/4/$ref", "#")];
          return false;
        }
        break;
      case "add":
      case "sub":
      case "mul":
      case "div":
      case "daysBetween":
      case "yearsBetween":
      case "min":
      case "max":
      case "roundTo":
      case "floorTo":
      case "ceilTo":
        const err128 = validate.errors;
        const res128 = ref94(data);
        const suberr128 = ref94.errors;
        validate.errors = err128;
        if (!res128) {
          validate.errors = [errorMerge(suberr128[0], "#/oneOf/5/$ref", "#")];
          return false;
        }
        break;
      case "eq":
      case "neq":
      case "lt":
      case "lte":
      case "gt":
      case "gte":
        const err131 = validate.errors;
        const res131 = ref95(data);
        const suberr131 = ref95.errors;
        validate.errors = err131;
        if (!res131) {
          validate.errors = [errorMerge(suberr131[0], "#/oneOf/6/$ref", "#")];
          return false;
        }
        break;
      case "sum":
        const err136 = validate.errors;
        const res136 = ref96(data);
        const suberr136 = ref96.errors;
        validate.errors = err136;
        if (!res136) {
          validate.errors = [errorMerge(suberr136[0], "#/oneOf/7/$ref", "#")];
          return false;
        }
        break;
      case "count":
        const err140 = validate.errors;
        const res140 = ref97(data);
        const suberr140 = ref97.errors;
        validate.errors = err140;
        if (!res140) {
          validate.errors = [errorMerge(suberr140[0], "#/oneOf/8/$ref", "#")];
          return false;
        }
        break;
      default:
        validate.errors = [{ keywordLocation: "#/oneOf", instanceLocation: "#" }];
        return false;
    }
    return true;
  };
  const ref89 = function validate(data) {
    validate.errors = null;
    if (!(typeof data === "object" && data && !Array.isArray(data))) {
      validate.errors = [{ keywordLocation: "#/type", instanceLocation: "#" }];
      return false;
    }
    if (!("kind" in data && hasOwn(data, "kind"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/kind" }];
      return false;
    }
    if (!("op" in data && hasOwn(data, "op"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/op" }];
      return false;
    }
    if (!("goal" in data && hasOwn(data, "goal"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/goal" }];
      return false;
    }
    if (!(typeof data.kind === "string")) {
      validate.errors = [{ keywordLocation: "#/properties/kind/type", instanceLocation: "#/kind" }];
      return false;
    }
    if (!(data.kind === "goal")) {
      validate.errors = [
        { keywordLocation: "#/properties/kind/const", instanceLocation: "#/kind" },
      ];
      return false;
    }
    if (!(typeof data.op === "string")) {
      validate.errors = [{ keywordLocation: "#/properties/op/type", instanceLocation: "#/op" }];
      return false;
    }
    if (!(data.op === "not")) {
      validate.errors = [{ keywordLocation: "#/properties/op/const", instanceLocation: "#/op" }];
      return false;
    }
    const err141 = validate.errors;
    const res141 = ref90(data.goal);
    const suberr141 = ref90.errors;
    validate.errors = err141;
    if (!res141) {
      validate.errors = [errorMerge(suberr141[0], "#/properties/goal/$ref", "#/goal")];
      return false;
    }
    return true;
  };
  const ref88 = function validate(data) {
    validate.errors = null;
    const err142 = validate.errors;
    const res142 = ref89(data);
    const suberr142 = ref89.errors;
    validate.errors = err142;
    if (!res142) {
      validate.errors = [errorMerge(suberr142[0], "#/$ref", "#")];
      return false;
    }
    return true;
  };
  const ref98 = function validate(data) {
    validate.errors = null;
    const err143 = validate.errors;
    const res143 = ref90(data);
    const suberr143 = ref90.errors;
    validate.errors = err143;
    if (!res143) {
      validate.errors = [errorMerge(suberr143[0], "#/$ref", "#")];
      return false;
    }
    return true;
  };
  const ref99 = function validate(data) {
    validate.errors = null;
    const err144 = validate.errors;
    const res144 = ref91(data);
    const suberr144 = ref91.errors;
    validate.errors = err144;
    if (!res144) {
      validate.errors = [errorMerge(suberr144[0], "#/$ref", "#")];
      return false;
    }
    return true;
  };
  const ref100 = function validate(data) {
    validate.errors = null;
    const err145 = validate.errors;
    const res145 = ref92(data);
    const suberr145 = ref92.errors;
    validate.errors = err145;
    if (!res145) {
      validate.errors = [errorMerge(suberr145[0], "#/$ref", "#")];
      return false;
    }
    return true;
  };
  const ref101 = function validate(data) {
    validate.errors = null;
    const err146 = validate.errors;
    const res146 = ref93(data);
    const suberr146 = ref93.errors;
    validate.errors = err146;
    if (!res146) {
      validate.errors = [errorMerge(suberr146[0], "#/$ref", "#")];
      return false;
    }
    return true;
  };
  const ref102 = function validate(data) {
    validate.errors = null;
    const err147 = validate.errors;
    const res147 = ref94(data);
    const suberr147 = ref94.errors;
    validate.errors = err147;
    if (!res147) {
      validate.errors = [errorMerge(suberr147[0], "#/$ref", "#")];
      return false;
    }
    return true;
  };
  const ref103 = function validate(data) {
    validate.errors = null;
    const err148 = validate.errors;
    const res148 = ref95(data);
    const suberr148 = ref95.errors;
    validate.errors = err148;
    if (!res148) {
      validate.errors = [errorMerge(suberr148[0], "#/$ref", "#")];
      return false;
    }
    return true;
  };
  const ref104 = function validate(data) {
    validate.errors = null;
    const err149 = validate.errors;
    const res149 = ref96(data);
    const suberr149 = ref96.errors;
    validate.errors = err149;
    if (!res149) {
      validate.errors = [errorMerge(suberr149[0], "#/$ref", "#")];
      return false;
    }
    return true;
  };
  const ref105 = function validate(data) {
    validate.errors = null;
    const err150 = validate.errors;
    const res150 = ref97(data);
    const suberr150 = ref97.errors;
    validate.errors = err150;
    if (!res150) {
      validate.errors = [errorMerge(suberr150[0], "#/$ref", "#")];
      return false;
    }
    return true;
  };
  const ref107 = function validate(data) {
    validate.errors = null;
    if (!(typeof data === "object" && data && !Array.isArray(data))) {
      validate.errors = [{ keywordLocation: "#/type", instanceLocation: "#" }];
      return false;
    }
    if (!("kind" in data && hasOwn(data, "kind"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/kind" }];
      return false;
    }
    if (!("variable" in data && hasOwn(data, "variable"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/variable" }];
      return false;
    }
    if (!(typeof data.kind === "string")) {
      validate.errors = [{ keywordLocation: "#/properties/kind/type", instanceLocation: "#/kind" }];
      return false;
    }
    if (!(data.kind === "missing-binding")) {
      validate.errors = [
        { keywordLocation: "#/properties/kind/const", instanceLocation: "#/kind" },
      ];
      return false;
    }
    const err151 = validate.errors;
    const res151 = ref11(data.variable);
    const suberr151 = ref11.errors;
    validate.errors = err151;
    if (!res151) {
      validate.errors = [errorMerge(suberr151[0], "#/properties/variable/$ref", "#/variable")];
      return false;
    }
    return true;
  };
  const ref106 = function validate(data) {
    validate.errors = null;
    const err152 = validate.errors;
    const res152 = ref107(data);
    const suberr152 = ref107.errors;
    validate.errors = err152;
    if (!res152) {
      validate.errors = [errorMerge(suberr152[0], "#/$ref", "#")];
      return false;
    }
    return true;
  };
  const ref109 = function validate(data) {
    validate.errors = null;
    if (!(typeof data === "object" && data && !Array.isArray(data))) {
      validate.errors = [{ keywordLocation: "#/type", instanceLocation: "#" }];
      return false;
    }
    if (!("kind" in data && hasOwn(data, "kind"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/kind" }];
      return false;
    }
    if (!(data.kind === "conflict" || data.kind === "unknown")) {
      validate.errors = [{ keywordLocation: "#/properties/kind/enum", instanceLocation: "#/kind" }];
      return false;
    }
    if ("count" in data && hasOwn(data, "count")) {
      if (!(typeof data.count === "number")) {
        validate.errors = [
          { keywordLocation: "#/properties/count/type", instanceLocation: "#/count" },
        ];
        return false;
      }
    }
    return true;
  };
  const ref108 = function validate(data) {
    validate.errors = null;
    const err153 = validate.errors;
    const res153 = ref109(data);
    const suberr153 = ref109.errors;
    validate.errors = err153;
    if (!res153) {
      validate.errors = [errorMerge(suberr153[0], "#/$ref", "#")];
      return false;
    }
    return true;
  };
  const ref111 = function validate(data) {
    validate.errors = null;
    if (!(typeof data === "string")) {
      validate.errors = [{ keywordLocation: "#/type", instanceLocation: "#" }];
      return false;
    }
    if (!(data === "conflict" || data === "unknown")) {
      validate.errors = [{ keywordLocation: "#/enum", instanceLocation: "#" }];
      return false;
    }
    return true;
  };
  const ref110 = function validate(data) {
    validate.errors = null;
    const err154 = validate.errors;
    const res154 = ref111(data);
    const suberr154 = ref111.errors;
    validate.errors = err154;
    if (!res154) {
      validate.errors = [errorMerge(suberr154[0], "#/$ref", "#")];
      return false;
    }
    return true;
  };
  const ref113 = function validate(data) {
    validate.errors = null;
    if (!(typeof data === "object" && data && !Array.isArray(data))) {
      validate.errors = [{ keywordLocation: "#/type", instanceLocation: "#" }];
      return false;
    }
    if (!("kind" in data && hasOwn(data, "kind"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/kind" }];
      return false;
    }
    if (!(typeof data.kind === "string")) {
      validate.errors = [{ keywordLocation: "#/properties/kind/type", instanceLocation: "#/kind" }];
      return false;
    }
    if (!(data.kind === "open-world")) {
      validate.errors = [
        { keywordLocation: "#/properties/kind/const", instanceLocation: "#/kind" },
      ];
      return false;
    }
    return true;
  };
  const ref112 = function validate(data) {
    validate.errors = null;
    const err155 = validate.errors;
    const res155 = ref113(data);
    const suberr155 = ref113.errors;
    validate.errors = err155;
    if (!res155) {
      validate.errors = [errorMerge(suberr155[0], "#/$ref", "#")];
      return false;
    }
    return true;
  };
  const ref115 = function validate(data) {
    validate.errors = null;
    if (!(typeof data === "object" && data && !Array.isArray(data))) {
      validate.errors = [{ keywordLocation: "#/type", instanceLocation: "#" }];
      return false;
    }
    if (!("lower" in data && hasOwn(data, "lower"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/lower" }];
      return false;
    }
    if (!("upper" in data && hasOwn(data, "upper"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/upper" }];
      return false;
    }
    const sub24 = (() => {
      if (!(typeof data.lower === "number")) return false;
      return true;
    })();
    const sub25 = (() => {
      const err156 = validate.errors;
      const res156 = ref5(data.lower);
      const suberr156 = ref5.errors;
      validate.errors = err156;
      if (!res156) return false;
      return true;
    })();
    if (!(sub24 || sub25)) {
      validate.errors = [
        { keywordLocation: "#/properties/lower/anyOf", instanceLocation: "#/lower" },
      ];
      return false;
    }
    const sub26 = (() => {
      if (!(typeof data.upper === "number")) return false;
      return true;
    })();
    const sub27 = (() => {
      const err157 = validate.errors;
      const res157 = ref5(data.upper);
      const suberr157 = ref5.errors;
      validate.errors = err157;
      if (!res157) return false;
      return true;
    })();
    if (!(sub26 || sub27)) {
      validate.errors = [
        { keywordLocation: "#/properties/upper/anyOf", instanceLocation: "#/upper" },
      ];
      return false;
    }
    return true;
  };
  const ref114 = function validate(data) {
    validate.errors = null;
    const err158 = validate.errors;
    const res158 = ref115(data);
    const suberr158 = ref115.errors;
    validate.errors = err158;
    if (!res158) {
      validate.errors = [errorMerge(suberr158[0], "#/$ref", "#")];
      return false;
    }
    return true;
  };
  const ref118 = function validate(data) {
    validate.errors = null;
    if (!(typeof data === "object" && data && !Array.isArray(data))) {
      validate.errors = [{ keywordLocation: "#/type", instanceLocation: "#" }];
      return false;
    }
    if (!("kind" in data && hasOwn(data, "kind"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/kind" }];
      return false;
    }
    switch (data.kind) {
      case "conflict":
      case "unknown":
        const err161 = validate.errors;
        const res161 = ref109(data);
        const suberr161 = ref109.errors;
        validate.errors = err161;
        if (!res161) {
          validate.errors = [errorMerge(suberr161[0], "#/oneOf/0/$ref", "#")];
          return false;
        }
        break;
      case "open-world":
        const err162 = validate.errors;
        const res162 = ref113(data);
        const suberr162 = ref113.errors;
        validate.errors = err162;
        if (!res162) {
          validate.errors = [errorMerge(suberr162[0], "#/oneOf/1/$ref", "#")];
          return false;
        }
        break;
      case "missing-binding":
        const err163 = validate.errors;
        const res163 = ref107(data);
        const suberr163 = ref107.errors;
        validate.errors = err163;
        if (!res163) {
          validate.errors = [errorMerge(suberr163[0], "#/oneOf/2/$ref", "#")];
          return false;
        }
        break;
      default:
        validate.errors = [{ keywordLocation: "#/oneOf", instanceLocation: "#" }];
        return false;
    }
    return true;
  };
  const ref117 = function validate(data) {
    validate.errors = null;
    if (!(typeof data === "object" && data && !Array.isArray(data))) {
      validate.errors = [{ keywordLocation: "#/type", instanceLocation: "#" }];
      return false;
    }
    if (!("kind" in data && hasOwn(data, "kind"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/kind" }];
      return false;
    }
    if (!("lower" in data && hasOwn(data, "lower"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/lower" }];
      return false;
    }
    if (!("upper" in data && hasOwn(data, "upper"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/upper" }];
      return false;
    }
    if (!("uncertainty" in data && hasOwn(data, "uncertainty"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/uncertainty" }];
      return false;
    }
    if (!(typeof data.kind === "string")) {
      validate.errors = [{ keywordLocation: "#/properties/kind/type", instanceLocation: "#/kind" }];
      return false;
    }
    if (!(data.kind === "numeric-range")) {
      validate.errors = [
        { keywordLocation: "#/properties/kind/const", instanceLocation: "#/kind" },
      ];
      return false;
    }
    const sub28 = (() => {
      if (!(typeof data.lower === "number")) return false;
      return true;
    })();
    const sub29 = (() => {
      const err159 = validate.errors;
      const res159 = ref5(data.lower);
      const suberr159 = ref5.errors;
      validate.errors = err159;
      if (!res159) return false;
      return true;
    })();
    if (!(sub28 || sub29)) {
      validate.errors = [
        { keywordLocation: "#/properties/lower/anyOf", instanceLocation: "#/lower" },
      ];
      return false;
    }
    const sub30 = (() => {
      if (!(typeof data.upper === "number")) return false;
      return true;
    })();
    const sub31 = (() => {
      const err160 = validate.errors;
      const res160 = ref5(data.upper);
      const suberr160 = ref5.errors;
      validate.errors = err160;
      if (!res160) return false;
      return true;
    })();
    if (!(sub30 || sub31)) {
      validate.errors = [
        { keywordLocation: "#/properties/upper/anyOf", instanceLocation: "#/upper" },
      ];
      return false;
    }
    if (!Array.isArray(data.uncertainty)) {
      validate.errors = [
        { keywordLocation: "#/properties/uncertainty/type", instanceLocation: "#/uncertainty" },
      ];
      return false;
    }
    for (let v = 0; v < data.uncertainty.length; v++) {
      if (v in data.uncertainty && hasOwn(data.uncertainty, v)) {
        const err164 = validate.errors;
        const res164 = ref118(data.uncertainty[v]);
        const suberr164 = ref118.errors;
        validate.errors = err164;
        if (!res164) {
          validate.errors = [
            errorMerge(suberr164[0], "#/properties/uncertainty/items/$ref", "#/uncertainty/" + v),
          ];
          return false;
        }
      }
    }
    return true;
  };
  const ref116 = function validate(data) {
    validate.errors = null;
    const err165 = validate.errors;
    const res165 = ref117(data);
    const suberr165 = ref117.errors;
    validate.errors = err165;
    if (!res165) {
      validate.errors = [errorMerge(suberr165[0], "#/$ref", "#")];
      return false;
    }
    return true;
  };
  const ref119 = function validate(data) {
    validate.errors = null;
    const err166 = validate.errors;
    const res166 = ref118(data);
    const suberr166 = ref118.errors;
    validate.errors = err166;
    if (!res166) {
      validate.errors = [errorMerge(suberr166[0], "#/$ref", "#")];
      return false;
    }
    return true;
  };
  const ref121 = function validate(data) {
    validate.errors = null;
    if (!(typeof data === "object" && data && !Array.isArray(data))) {
      validate.errors = [{ keywordLocation: "#/type", instanceLocation: "#" }];
      return false;
    }
    if (!("source" in data && hasOwn(data, "source"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/source" }];
      return false;
    }
    if (!("literals" in data && hasOwn(data, "literals"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/literals" }];
      return false;
    }
    if (!(typeof data.source === "string")) {
      validate.errors = [
        { keywordLocation: "#/properties/source/type", instanceLocation: "#/source" },
      ];
      return false;
    }
    if (!(data.source === "evidence")) {
      validate.errors = [
        { keywordLocation: "#/properties/source/const", instanceLocation: "#/source" },
      ];
      return false;
    }
    if (!Array.isArray(data.literals)) {
      validate.errors = [
        { keywordLocation: "#/properties/literals/type", instanceLocation: "#/literals" },
      ];
      return false;
    }
    for (let x = 0; x < data.literals.length; x++) {
      if (x in data.literals && hasOwn(data.literals, x)) {
        const err167 = validate.errors;
        const res167 = ref30(data.literals[x]);
        const suberr167 = ref30.errors;
        validate.errors = err167;
        if (!res167) {
          validate.errors = [
            errorMerge(suberr167[0], "#/properties/literals/items/$ref", "#/literals/" + x),
          ];
          return false;
        }
      }
    }
    return true;
  };
  const ref120 = function validate(data) {
    validate.errors = null;
    const err168 = validate.errors;
    const res168 = ref121(data);
    const suberr168 = ref121.errors;
    validate.errors = err168;
    if (!res168) {
      validate.errors = [errorMerge(suberr168[0], "#/$ref", "#")];
      return false;
    }
    return true;
  };
  const ref123 = function validate(data) {
    validate.errors = null;
    if (!(typeof data === "object" && data && !Array.isArray(data))) {
      validate.errors = [{ keywordLocation: "#/type", instanceLocation: "#" }];
      return false;
    }
    if (!("source" in data && hasOwn(data, "source"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/source" }];
      return false;
    }
    if (!(typeof data.source === "string")) {
      validate.errors = [
        { keywordLocation: "#/properties/source/type", instanceLocation: "#/source" },
      ];
      return false;
    }
    if (!(data.source === "closed-world-absence")) {
      validate.errors = [
        { keywordLocation: "#/properties/source/const", instanceLocation: "#/source" },
      ];
      return false;
    }
    return true;
  };
  const ref122 = function validate(data) {
    validate.errors = null;
    const err169 = validate.errors;
    const res169 = ref123(data);
    const suberr169 = ref123.errors;
    validate.errors = err169;
    if (!res169) {
      validate.errors = [errorMerge(suberr169[0], "#/$ref", "#")];
      return false;
    }
    return true;
  };
  const ref127 = function validate(data) {
    validate.errors = null;
    if (!(typeof data === "string")) {
      validate.errors = [{ keywordLocation: "#/type", instanceLocation: "#" }];
      return false;
    }
    if (!(data === "true" || data === "false" || data === "unknown" || data === "conflicted")) {
      validate.errors = [{ keywordLocation: "#/enum", instanceLocation: "#" }];
      return false;
    }
    return true;
  };
  const ref128 = function validate(data) {
    validate.errors = null;
    let passes5 = 0;
    const sub32 = (() => {
      const err174 = validate.errors;
      const res174 = ref16(data);
      const suberr174 = ref16.errors;
      validate.errors = err174;
      if (!res174) return false;
      return true;
    })();
    if (sub32) passes5++;
    const sub33 = (() => {
      const err175 = validate.errors;
      const res175 = ref117(data);
      const suberr175 = ref117.errors;
      validate.errors = err175;
      if (!res175) return false;
      return true;
    })();
    if (sub33) passes5++;
    if (passes5 !== 1) {
      validate.errors = [{ keywordLocation: "#/oneOf", instanceLocation: "#" }];
      return false;
    }
    return true;
  };
  const ref130 = function validate(data) {
    validate.errors = null;
    if (!(typeof data === "object" && data && !Array.isArray(data))) {
      validate.errors = [{ keywordLocation: "#/type", instanceLocation: "#" }];
      return false;
    }
    if (!("source" in data && hasOwn(data, "source"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/source" }];
      return false;
    }
    if (!("judgments" in data && hasOwn(data, "judgments"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/judgments" }];
      return false;
    }
    if (!(typeof data.source === "string")) {
      validate.errors = [
        { keywordLocation: "#/properties/source/type", instanceLocation: "#/source" },
      ];
      return false;
    }
    if (!(data.source === "subgoals")) {
      validate.errors = [
        { keywordLocation: "#/properties/source/const", instanceLocation: "#/source" },
      ];
      return false;
    }
    if (!Array.isArray(data.judgments)) {
      validate.errors = [
        { keywordLocation: "#/properties/judgments/type", instanceLocation: "#/judgments" },
      ];
      return false;
    }
    for (let ii = 0; ii < data.judgments.length; ii++) {
      if (ii in data.judgments && hasOwn(data.judgments, ii)) {
        const err180 = validate.errors;
        const res180 = ref126(data.judgments[ii]);
        const suberr180 = ref126.errors;
        validate.errors = err180;
        if (!res180) {
          validate.errors = [
            errorMerge(suberr180[0], "#/properties/judgments/items/$ref", "#/judgments/" + ii),
          ];
          return false;
        }
      }
    }
    return true;
  };
  const ref132 = function validate(data) {
    validate.errors = null;
    if (!(typeof data === "object" && data && !Array.isArray(data))) {
      validate.errors = [{ keywordLocation: "#/type", instanceLocation: "#" }];
      return false;
    }
    if (!("operation" in data && hasOwn(data, "operation"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/operation" }];
      return false;
    }
    if (!("operands" in data && hasOwn(data, "operands"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/operands" }];
      return false;
    }
    if (!("value" in data && hasOwn(data, "value"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/value" }];
      return false;
    }
    if (!(typeof data.operation === "string")) {
      validate.errors = [
        { keywordLocation: "#/properties/operation/type", instanceLocation: "#/operation" },
      ];
      return false;
    }
    if (!Array.isArray(data.operands)) {
      validate.errors = [
        { keywordLocation: "#/properties/operands/type", instanceLocation: "#/operands" },
      ];
      return false;
    }
    for (let jj = 0; jj < data.operands.length; jj++) {
      if (jj in data.operands && hasOwn(data.operands, jj)) {
        const sub34 = (() => {
          const err182 = validate.errors;
          const res182 = ref128(data.operands[jj]);
          const suberr182 = ref128.errors;
          validate.errors = err182;
          if (!res182) return false;
          return true;
        })();
        const sub35 = (() => {
          const err183 = validate.errors;
          const res183 = ref107(data.operands[jj]);
          const suberr183 = ref107.errors;
          validate.errors = err183;
          if (!res183) return false;
          return true;
        })();
        if (!(sub34 || sub35)) {
          validate.errors = [
            {
              keywordLocation: "#/properties/operands/items/anyOf",
              instanceLocation: "#/operands/" + jj,
            },
          ];
          return false;
        }
      }
    }
    const err184 = validate.errors;
    const res184 = ref127(data.value);
    const suberr184 = ref127.errors;
    validate.errors = err184;
    if (!res184) {
      validate.errors = [errorMerge(suberr184[0], "#/properties/value/$ref", "#/value")];
      return false;
    }
    if ("result" in data && hasOwn(data, "result")) {
      const err185 = validate.errors;
      const res185 = ref128(data.result);
      const suberr185 = ref128.errors;
      validate.errors = err185;
      if (!res185) {
        validate.errors = [errorMerge(suberr185[0], "#/properties/result/$ref", "#/result")];
        return false;
      }
    }
    if ("results" in data && hasOwn(data, "results")) {
      if (!Array.isArray(data.results)) {
        validate.errors = [
          { keywordLocation: "#/properties/results/type", instanceLocation: "#/results" },
        ];
        return false;
      }
      for (let kk = 0; kk < data.results.length; kk++) {
        if (kk in data.results && hasOwn(data.results, kk)) {
          if (!Array.isArray(data.results[kk])) {
            validate.errors = [
              {
                keywordLocation: "#/properties/results/items/type",
                instanceLocation: "#/results/" + kk,
              },
            ];
            return false;
          }
          if (data.results[kk].length > 2) {
            validate.errors = [
              {
                keywordLocation: "#/properties/results/items/maxItems",
                instanceLocation: "#/results/" + kk,
              },
            ];
            return false;
          }
          if (data.results[kk].length < 2) {
            validate.errors = [
              {
                keywordLocation: "#/properties/results/items/minItems",
                instanceLocation: "#/results/" + kk,
              },
            ];
            return false;
          }
          if (0 in data.results[kk] && hasOwn(data.results[kk], 0)) {
            const err186 = validate.errors;
            const res186 = ref11(data.results[kk][0]);
            const suberr186 = ref11.errors;
            validate.errors = err186;
            if (!res186) {
              validate.errors = [
                errorMerge(suberr186[0], "#/properties/results/items/0/$ref", "#/results/" + kk),
              ];
              return false;
            }
          }
          if (1 in data.results[kk] && hasOwn(data.results[kk], 1)) {
            const err187 = validate.errors;
            const res187 = ref128(data.results[kk][1]);
            const suberr187 = ref128.errors;
            validate.errors = err187;
            if (!res187) {
              validate.errors = [
                errorMerge(
                  suberr187[0],
                  "#/properties/results/items/1/$ref",
                  "#/results/" + kk + "/1",
                ),
              ];
              return false;
            }
          }
        }
      }
    }
    if ("range" in data && hasOwn(data, "range")) {
      const err188 = validate.errors;
      const res188 = ref115(data.range);
      const suberr188 = ref115.errors;
      validate.errors = err188;
      if (!res188) {
        validate.errors = [errorMerge(suberr188[0], "#/properties/range/$ref", "#/range")];
        return false;
      }
    }
    if ("uncertainty" in data && hasOwn(data, "uncertainty")) {
      if (!Array.isArray(data.uncertainty)) {
        validate.errors = [
          { keywordLocation: "#/properties/uncertainty/type", instanceLocation: "#/uncertainty" },
        ];
        return false;
      }
      for (let ll = 0; ll < data.uncertainty.length; ll++) {
        if (ll in data.uncertainty && hasOwn(data.uncertainty, ll)) {
          const err189 = validate.errors;
          const res189 = ref118(data.uncertainty[ll]);
          const suberr189 = ref118.errors;
          validate.errors = err189;
          if (!res189) {
            validate.errors = [
              errorMerge(
                suberr189[0],
                "#/properties/uncertainty/items/$ref",
                "#/uncertainty/" + ll,
              ),
            ];
            return false;
          }
        }
      }
    }
    return true;
  };
  const ref131 = function validate(data) {
    validate.errors = null;
    if (!(typeof data === "object" && data && !Array.isArray(data))) {
      validate.errors = [{ keywordLocation: "#/type", instanceLocation: "#" }];
      return false;
    }
    if (!("source" in data && hasOwn(data, "source"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/source" }];
      return false;
    }
    if (!("evaluation" in data && hasOwn(data, "evaluation"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/evaluation" }];
      return false;
    }
    if (!(typeof data.source === "string")) {
      validate.errors = [
        { keywordLocation: "#/properties/source/type", instanceLocation: "#/source" },
      ];
      return false;
    }
    if (!(data.source === "primitive")) {
      validate.errors = [
        { keywordLocation: "#/properties/source/const", instanceLocation: "#/source" },
      ];
      return false;
    }
    const err190 = validate.errors;
    const res190 = ref132(data.evaluation);
    const suberr190 = ref132.errors;
    validate.errors = err190;
    if (!res190) {
      validate.errors = [errorMerge(suberr190[0], "#/properties/evaluation/$ref", "#/evaluation")];
      return false;
    }
    return true;
  };
  const ref129 = function validate(data) {
    validate.errors = null;
    if (!(typeof data === "object" && data && !Array.isArray(data))) {
      validate.errors = [{ keywordLocation: "#/type", instanceLocation: "#" }];
      return false;
    }
    if (!("source" in data && hasOwn(data, "source"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/source" }];
      return false;
    }
    switch (data.source) {
      case "evidence":
        const err177 = validate.errors;
        const res177 = ref121(data);
        const suberr177 = ref121.errors;
        validate.errors = err177;
        if (!res177) {
          validate.errors = [errorMerge(suberr177[0], "#/oneOf/0/$ref", "#")];
          return false;
        }
        break;
      case "closed-world-absence":
        const err178 = validate.errors;
        const res178 = ref123(data);
        const suberr178 = ref123.errors;
        validate.errors = err178;
        if (!res178) {
          validate.errors = [errorMerge(suberr178[0], "#/oneOf/1/$ref", "#")];
          return false;
        }
        break;
      case "rule":
        const err179 = validate.errors;
        const res179 = ref125(data);
        const suberr179 = ref125.errors;
        validate.errors = err179;
        if (!res179) {
          validate.errors = [errorMerge(suberr179[0], "#/oneOf/2/$ref", "#")];
          return false;
        }
        break;
      case "subgoals":
        const err181 = validate.errors;
        const res181 = ref130(data);
        const suberr181 = ref130.errors;
        validate.errors = err181;
        if (!res181) {
          validate.errors = [errorMerge(suberr181[0], "#/oneOf/3/$ref", "#")];
          return false;
        }
        break;
      case "primitive":
        const err191 = validate.errors;
        const res191 = ref131(data);
        const suberr191 = ref131.errors;
        validate.errors = err191;
        if (!res191) {
          validate.errors = [errorMerge(suberr191[0], "#/oneOf/4/$ref", "#")];
          return false;
        }
        break;
      default:
        validate.errors = [{ keywordLocation: "#/oneOf", instanceLocation: "#" }];
        return false;
    }
    return true;
  };
  const ref126 = function validate(data) {
    validate.errors = null;
    if (!(typeof data === "object" && data && !Array.isArray(data))) {
      validate.errors = [{ keywordLocation: "#/type", instanceLocation: "#" }];
      return false;
    }
    if (!("goal" in data && hasOwn(data, "goal"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/goal" }];
      return false;
    }
    if (!("value" in data && hasOwn(data, "value"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/value" }];
      return false;
    }
    if (!("bindings" in data && hasOwn(data, "bindings"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/bindings" }];
      return false;
    }
    const err171 = validate.errors;
    const res171 = ref90(data.goal);
    const suberr171 = ref90.errors;
    validate.errors = err171;
    if (!res171) {
      validate.errors = [errorMerge(suberr171[0], "#/properties/goal/$ref", "#/goal")];
      return false;
    }
    const err172 = validate.errors;
    const res172 = ref127(data.value);
    const suberr172 = ref127.errors;
    validate.errors = err172;
    if (!res172) {
      validate.errors = [errorMerge(suberr172[0], "#/properties/value/$ref", "#/value")];
      return false;
    }
    if (!Array.isArray(data.bindings)) {
      validate.errors = [
        { keywordLocation: "#/properties/bindings/type", instanceLocation: "#/bindings" },
      ];
      return false;
    }
    for (let y = 0; y < data.bindings.length; y++) {
      if (y in data.bindings && hasOwn(data.bindings, y)) {
        if (!Array.isArray(data.bindings[y])) {
          validate.errors = [
            {
              keywordLocation: "#/properties/bindings/items/type",
              instanceLocation: "#/bindings/" + y,
            },
          ];
          return false;
        }
        if (data.bindings[y].length > 2) {
          validate.errors = [
            {
              keywordLocation: "#/properties/bindings/items/maxItems",
              instanceLocation: "#/bindings/" + y,
            },
          ];
          return false;
        }
        if (data.bindings[y].length < 2) {
          validate.errors = [
            {
              keywordLocation: "#/properties/bindings/items/minItems",
              instanceLocation: "#/bindings/" + y,
            },
          ];
          return false;
        }
        if (0 in data.bindings[y] && hasOwn(data.bindings[y], 0)) {
          const err173 = validate.errors;
          const res173 = ref11(data.bindings[y][0]);
          const suberr173 = ref11.errors;
          validate.errors = err173;
          if (!res173) {
            validate.errors = [
              errorMerge(suberr173[0], "#/properties/bindings/items/0/$ref", "#/bindings/" + y),
            ];
            return false;
          }
        }
        if (1 in data.bindings[y] && hasOwn(data.bindings[y], 1)) {
          const err176 = validate.errors;
          const res176 = ref128(data.bindings[y][1]);
          const suberr176 = ref128.errors;
          validate.errors = err176;
          if (!res176) {
            validate.errors = [
              errorMerge(
                suberr176[0],
                "#/properties/bindings/items/1/$ref",
                "#/bindings/" + y + "/1",
              ),
            ];
            return false;
          }
        }
      }
    }
    if ("positive" in data && hasOwn(data, "positive")) {
      if (!Array.isArray(data.positive)) {
        validate.errors = [
          { keywordLocation: "#/properties/positive/type", instanceLocation: "#/positive" },
        ];
        return false;
      }
      for (let z = 0; z < data.positive.length; z++) {
        if (z in data.positive && hasOwn(data.positive, z)) {
          const err192 = validate.errors;
          const res192 = ref129(data.positive[z]);
          const suberr192 = ref129.errors;
          validate.errors = err192;
          if (!res192) {
            validate.errors = [
              errorMerge(suberr192[0], "#/properties/positive/items/$ref", "#/positive/" + z),
            ];
            return false;
          }
        }
      }
    }
    if ("negative" in data && hasOwn(data, "negative")) {
      if (!Array.isArray(data.negative)) {
        validate.errors = [
          { keywordLocation: "#/properties/negative/type", instanceLocation: "#/negative" },
        ];
        return false;
      }
      for (let mm = 0; mm < data.negative.length; mm++) {
        if (mm in data.negative && hasOwn(data.negative, mm)) {
          const err193 = validate.errors;
          const res193 = ref129(data.negative[mm]);
          const suberr193 = ref129.errors;
          validate.errors = err193;
          if (!res193) {
            validate.errors = [
              errorMerge(suberr193[0], "#/properties/negative/items/$ref", "#/negative/" + mm),
            ];
            return false;
          }
        }
      }
    }
    if ("inconclusive" in data && hasOwn(data, "inconclusive")) {
      if (!Array.isArray(data.inconclusive)) {
        validate.errors = [
          { keywordLocation: "#/properties/inconclusive/type", instanceLocation: "#/inconclusive" },
        ];
        return false;
      }
      for (let nn = 0; nn < data.inconclusive.length; nn++) {
        if (nn in data.inconclusive && hasOwn(data.inconclusive, nn)) {
          const err194 = validate.errors;
          const res194 = ref129(data.inconclusive[nn]);
          const suberr194 = ref129.errors;
          validate.errors = err194;
          if (!res194) {
            validate.errors = [
              errorMerge(
                suberr194[0],
                "#/properties/inconclusive/items/$ref",
                "#/inconclusive/" + nn,
              ),
            ];
            return false;
          }
        }
      }
    }
    return true;
  };
  const ref125 = function validate(data) {
    validate.errors = null;
    if (!(typeof data === "object" && data && !Array.isArray(data))) {
      validate.errors = [{ keywordLocation: "#/type", instanceLocation: "#" }];
      return false;
    }
    if (!("source" in data && hasOwn(data, "source"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/source" }];
      return false;
    }
    if (!("rule" in data && hasOwn(data, "rule"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/rule" }];
      return false;
    }
    if (!("body" in data && hasOwn(data, "body"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/body" }];
      return false;
    }
    if (!(typeof data.source === "string")) {
      validate.errors = [
        { keywordLocation: "#/properties/source/type", instanceLocation: "#/source" },
      ];
      return false;
    }
    if (!(data.source === "rule")) {
      validate.errors = [
        { keywordLocation: "#/properties/source/const", instanceLocation: "#/source" },
      ];
      return false;
    }
    const err170 = validate.errors;
    const res170 = ref79(data.rule);
    const suberr170 = ref79.errors;
    validate.errors = err170;
    if (!res170) {
      validate.errors = [errorMerge(suberr170[0], "#/properties/rule/$ref", "#/rule")];
      return false;
    }
    const err195 = validate.errors;
    const res195 = ref126(data.body);
    const suberr195 = ref126.errors;
    validate.errors = err195;
    if (!res195) {
      validate.errors = [errorMerge(suberr195[0], "#/properties/body/$ref", "#/body")];
      return false;
    }
    return true;
  };
  const ref124 = function validate(data) {
    validate.errors = null;
    const err196 = validate.errors;
    const res196 = ref125(data);
    const suberr196 = ref125.errors;
    validate.errors = err196;
    if (!res196) {
      validate.errors = [errorMerge(suberr196[0], "#/$ref", "#")];
      return false;
    }
    return true;
  };
  const ref133 = function validate(data) {
    validate.errors = null;
    const err197 = validate.errors;
    const res197 = ref126(data);
    const suberr197 = ref126.errors;
    validate.errors = err197;
    if (!res197) {
      validate.errors = [errorMerge(suberr197[0], "#/$ref", "#")];
      return false;
    }
    return true;
  };
  const ref134 = function validate(data) {
    validate.errors = null;
    const err198 = validate.errors;
    const res198 = ref127(data);
    const suberr198 = ref127.errors;
    validate.errors = err198;
    if (!res198) {
      validate.errors = [errorMerge(suberr198[0], "#/$ref", "#")];
      return false;
    }
    return true;
  };
  const ref135 = function validate(data) {
    validate.errors = null;
    const err199 = validate.errors;
    const res199 = ref128(data);
    const suberr199 = ref128.errors;
    validate.errors = err199;
    if (!res199) {
      validate.errors = [errorMerge(suberr199[0], "#/$ref", "#")];
      return false;
    }
    return true;
  };
  const ref136 = function validate(data) {
    validate.errors = null;
    const err200 = validate.errors;
    const res200 = ref129(data);
    const suberr200 = ref129.errors;
    validate.errors = err200;
    if (!res200) {
      validate.errors = [errorMerge(suberr200[0], "#/$ref", "#")];
      return false;
    }
    return true;
  };
  const ref137 = function validate(data) {
    validate.errors = null;
    const err201 = validate.errors;
    const res201 = ref130(data);
    const suberr201 = ref130.errors;
    validate.errors = err201;
    if (!res201) {
      validate.errors = [errorMerge(suberr201[0], "#/$ref", "#")];
      return false;
    }
    return true;
  };
  const ref138 = function validate(data) {
    validate.errors = null;
    const err202 = validate.errors;
    const res202 = ref131(data);
    const suberr202 = ref131.errors;
    validate.errors = err202;
    if (!res202) {
      validate.errors = [errorMerge(suberr202[0], "#/$ref", "#")];
      return false;
    }
    return true;
  };
  const ref139 = function validate(data) {
    validate.errors = null;
    const err203 = validate.errors;
    const res203 = ref132(data);
    const suberr203 = ref132.errors;
    validate.errors = err203;
    if (!res203) {
      validate.errors = [errorMerge(suberr203[0], "#/$ref", "#")];
      return false;
    }
    return true;
  };
  const ref141 = function validate(data) {
    validate.errors = null;
    if (!(typeof data === "object" && data && !Array.isArray(data))) {
      validate.errors = [{ keywordLocation: "#/type", instanceLocation: "#" }];
      return false;
    }
    if (!("value" in data && hasOwn(data, "value"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/value" }];
      return false;
    }
    if (!("bindings" in data && hasOwn(data, "bindings"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/bindings" }];
      return false;
    }
    if (!("goal" in data && hasOwn(data, "goal"))) {
      validate.errors = [{ keywordLocation: "#/required", instanceLocation: "#/goal" }];
      return false;
    }
    const err204 = validate.errors;
    const res204 = ref127(data.value);
    const suberr204 = ref127.errors;
    validate.errors = err204;
    if (!res204) {
      validate.errors = [errorMerge(suberr204[0], "#/properties/value/$ref", "#/value")];
      return false;
    }
    if (!Array.isArray(data.bindings)) {
      validate.errors = [
        { keywordLocation: "#/properties/bindings/type", instanceLocation: "#/bindings" },
      ];
      return false;
    }
    for (let oo = 0; oo < data.bindings.length; oo++) {
      if (oo in data.bindings && hasOwn(data.bindings, oo)) {
        if (!Array.isArray(data.bindings[oo])) {
          validate.errors = [
            {
              keywordLocation: "#/properties/bindings/items/type",
              instanceLocation: "#/bindings/" + oo,
            },
          ];
          return false;
        }
        if (data.bindings[oo].length > 2) {
          validate.errors = [
            {
              keywordLocation: "#/properties/bindings/items/maxItems",
              instanceLocation: "#/bindings/" + oo,
            },
          ];
          return false;
        }
        if (data.bindings[oo].length < 2) {
          validate.errors = [
            {
              keywordLocation: "#/properties/bindings/items/minItems",
              instanceLocation: "#/bindings/" + oo,
            },
          ];
          return false;
        }
        if (0 in data.bindings[oo] && hasOwn(data.bindings[oo], 0)) {
          const err205 = validate.errors;
          const res205 = ref11(data.bindings[oo][0]);
          const suberr205 = ref11.errors;
          validate.errors = err205;
          if (!res205) {
            validate.errors = [
              errorMerge(suberr205[0], "#/properties/bindings/items/0/$ref", "#/bindings/" + oo),
            ];
            return false;
          }
        }
        if (1 in data.bindings[oo] && hasOwn(data.bindings[oo], 1)) {
          const err206 = validate.errors;
          const res206 = ref128(data.bindings[oo][1]);
          const suberr206 = ref128.errors;
          validate.errors = err206;
          if (!res206) {
            validate.errors = [
              errorMerge(
                suberr206[0],
                "#/properties/bindings/items/1/$ref",
                "#/bindings/" + oo + "/1",
              ),
            ];
            return false;
          }
        }
      }
    }
    if ("positive" in data && hasOwn(data, "positive")) {
      if (!Array.isArray(data.positive)) {
        validate.errors = [
          { keywordLocation: "#/properties/positive/type", instanceLocation: "#/positive" },
        ];
        return false;
      }
      for (let pp = 0; pp < data.positive.length; pp++) {
        if (pp in data.positive && hasOwn(data.positive, pp)) {
          const err207 = validate.errors;
          const res207 = ref129(data.positive[pp]);
          const suberr207 = ref129.errors;
          validate.errors = err207;
          if (!res207) {
            validate.errors = [
              errorMerge(suberr207[0], "#/properties/positive/items/$ref", "#/positive/" + pp),
            ];
            return false;
          }
        }
      }
    }
    if ("negative" in data && hasOwn(data, "negative")) {
      if (!Array.isArray(data.negative)) {
        validate.errors = [
          { keywordLocation: "#/properties/negative/type", instanceLocation: "#/negative" },
        ];
        return false;
      }
      for (let qq = 0; qq < data.negative.length; qq++) {
        if (qq in data.negative && hasOwn(data.negative, qq)) {
          const err208 = validate.errors;
          const res208 = ref129(data.negative[qq]);
          const suberr208 = ref129.errors;
          validate.errors = err208;
          if (!res208) {
            validate.errors = [
              errorMerge(suberr208[0], "#/properties/negative/items/$ref", "#/negative/" + qq),
            ];
            return false;
          }
        }
      }
    }
    if ("inconclusive" in data && hasOwn(data, "inconclusive")) {
      if (!Array.isArray(data.inconclusive)) {
        validate.errors = [
          { keywordLocation: "#/properties/inconclusive/type", instanceLocation: "#/inconclusive" },
        ];
        return false;
      }
      for (let rr = 0; rr < data.inconclusive.length; rr++) {
        if (rr in data.inconclusive && hasOwn(data.inconclusive, rr)) {
          const err209 = validate.errors;
          const res209 = ref129(data.inconclusive[rr]);
          const suberr209 = ref129.errors;
          validate.errors = err209;
          if (!res209) {
            validate.errors = [
              errorMerge(
                suberr209[0],
                "#/properties/inconclusive/items/$ref",
                "#/inconclusive/" + rr,
              ),
            ];
            return false;
          }
        }
      }
    }
    const err210 = validate.errors;
    const res210 = ref87(data.goal);
    const suberr210 = ref87.errors;
    validate.errors = err210;
    if (!res210) {
      validate.errors = [errorMerge(suberr210[0], "#/properties/goal/$ref", "#/goal")];
      return false;
    }
    return true;
  };
  const ref140 = function validate(data) {
    validate.errors = null;
    const err211 = validate.errors;
    const res211 = ref141(data);
    const suberr211 = ref141.errors;
    validate.errors = err211;
    if (!res211) {
      validate.errors = [errorMerge(suberr211[0], "#/$ref", "#")];
      return false;
    }
    return true;
  };
  return [
    ref0,
    ref3,
    ref4,
    ref7,
    ref8,
    ref10,
    ref12,
    ref17,
    ref18,
    ref19,
    ref22,
    ref28,
    ref29,
    ref32,
    ref33,
    ref36,
    ref37,
    ref39,
    ref43,
    ref49,
    ref50,
    ref51,
    ref52,
    ref64,
    ref65,
    ref66,
    ref67,
    ref68,
    ref69,
    ref70,
    ref71,
    ref73,
    ref74,
    ref75,
    ref76,
    ref78,
    ref81,
    ref82,
    ref84,
    ref86,
    ref88,
    ref98,
    ref99,
    ref100,
    ref101,
    ref102,
    ref103,
    ref104,
    ref105,
    ref106,
    ref108,
    ref110,
    ref112,
    ref114,
    ref116,
    ref119,
    ref120,
    ref122,
    ref124,
    ref133,
    ref134,
    ref135,
    ref136,
    ref137,
    ref138,
    ref139,
    ref140,
  ];
})();
export const validateEntityRef = validators[0];
export const validateName = validators[1];
export const validateInfiniteNumber = validators[2];
export const validateInfiniteNumberValue = validators[3];
export const validateDateValue = validators[4];
export const validateVariable = validators[5];
export const validateAtom = validators[6];
export const validateTerm = validators[7];
export const validateValue = validators[8];
export const validateGroundAtom = validators[9];
export const validateEvidenceMetadata = validators[10];
export const validateAnnotationValue = validators[11];
export const validateLiteral = validators[12];
export const validateSign = validators[13];
export const validateEnumType = validators[14];
export const validateEnumValue = validators[15];
export const validateEntityType = validators[16];
export const validatePredicateMetadata = validators[17];
export const validatePredicate = validators[18];
export const validatePredicateWorld = validators[19];
export const validateFieldType = validators[20];
export const validateScalarType = validators[21];
export const validateArithmetic = validators[22];
export const validateArithmeticKind = validators[23];
export const validateExpression = validators[24];
export const validateAggregate = validators[25];
export const validateAggregateKind = validators[26];
export const validateCondition = validators[27];
export const validateNot = validators[28];
export const validateConnective = validators[29];
export const validateConnectiveKind = validators[30];
export const validateExists = validators[31];
export const validateLetIn = validators[32];
export const validateComparison = validators[33];
export const validateComparisonKind = validators[34];
export const validateRule = validators[35];
export const validateRuleKind = validators[36];
export const validateProgram = validators[37];
export const validateKnowledgeBaseDocument = validators[38];
export const validateAtomGoal = validators[39];
export const validateNotGoal = validators[40];
export const validateGoal = validators[41];
export const validateConnectiveGoal = validators[42];
export const validateExistsGoal = validators[43];
export const validateLetGoal = validators[44];
export const validateArithmeticGoal = validators[45];
export const validateComparisonGoal = validators[46];
export const validateSumGoal = validators[47];
export const validateCountGoal = validators[48];
export const validateMissingBinding = validators[49];
export const validateUnsettledEvidence = validators[50];
export const validateUnsettledKind = validators[51];
export const validateOpenWorld = validators[52];
export const validateNumericRange = validators[53];
export const validateNumericRangeValue = validators[54];
export const validateUncertainty = validators[55];
export const validateEvidenceSupport = validators[56];
export const validateClosedWorldAbsenceSupport = validators[57];
export const validateRuleSupport = validators[58];
export const validateJudgment = validators[59];
export const validateTruthValue = validators[60];
export const validateBoundValue = validators[61];
export const validateSupport = validators[62];
export const validateSubgoalsSupport = validators[63];
export const validatePrimitiveSupport = validators[64];
export const validatePrimitiveEvaluation = validators[65];
export const validateQueryJudgment = validators[66];
