import {
  isValidFirestoreId,
  isValidGameNumber,
  isValidPaginationLimit,
  isValidScore,
  sanitizeString,
  validateRequiredFields,
} from "@/lib/validation";

describe("validation helpers", () => {
  describe("isValidFirestoreId", () => {
    it("accepts ids that match the firestore id pattern", () => {
      expect(isValidFirestoreId("abc_123-XYZ")).toBe(true);
    });

    it("rejects ids with invalid characters or excessive length", () => {
      expect(isValidFirestoreId("bad/id")).toBe(false);
      expect(isValidFirestoreId("a".repeat(129))).toBe(false);
    });
  });

  describe("isValidScore", () => {
    it("accepts integer scores between 0 and 300", () => {
      expect(isValidScore(0)).toBe(true);
      expect(isValidScore(300)).toBe(true);
    });

    it("rejects scores outside the allowed range or non-integers", () => {
      expect(isValidScore(-1)).toBe(false);
      expect(isValidScore(301)).toBe(false);
      expect(isValidScore(99.5)).toBe(false);
    });
  });

  describe("isValidGameNumber", () => {
    it("accepts integer game numbers between 1 and 6", () => {
      expect(isValidGameNumber(1)).toBe(true);
      expect(isValidGameNumber(6)).toBe(true);
    });

    it("rejects values outside the allowed range or non-integers", () => {
      expect(isValidGameNumber(0)).toBe(false);
      expect(isValidGameNumber(7)).toBe(false);
      expect(isValidGameNumber(2.5)).toBe(false);
    });
  });

  describe("isValidPaginationLimit", () => {
    it("accepts integer limits between 1 and 100", () => {
      expect(isValidPaginationLimit(1)).toBe(true);
      expect(isValidPaginationLimit(100)).toBe(true);
    });

    it("rejects values outside the allowed range or non-integers", () => {
      expect(isValidPaginationLimit(0)).toBe(false);
      expect(isValidPaginationLimit(101)).toBe(false);
      expect(isValidPaginationLimit(10.5)).toBe(false);
    });
  });

  describe("sanitizeString", () => {
    it("trims, removes null bytes, and truncates to the default length", () => {
      const value = `  abc${String.fromCharCode(0)}def  `;
      expect(sanitizeString(value)).toBe("abcdef");
      expect(sanitizeString("x".repeat(250))).toHaveLength(200);
    });

    it("uses a custom maximum length when provided", () => {
      expect(sanitizeString("  abcdef  ", 3)).toBe("abc");
    });
  });

  describe("validateRequiredFields", () => {
    it("returns valid when all required fields are present", () => {
      expect(validateRequiredFields({ name: "test", count: 1 }, ["name", "count"])).toEqual({
        valid: true,
        missing: [],
      });
    });

    it("reports missing fields when values are null or undefined", () => {
      expect(validateRequiredFields({ name: null, count: undefined }, ["name", "count"])).toEqual({
        valid: false,
        missing: ["name", "count"],
      });
    });
  });
});
