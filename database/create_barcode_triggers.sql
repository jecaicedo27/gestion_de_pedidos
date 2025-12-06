DELIMITER //

DROP TRIGGER IF EXISTS products_barcode_before_insert //
CREATE TRIGGER products_barcode_before_insert
BEFORE INSERT ON products
FOR EACH ROW
BEGIN
  SET NEW.barcode =
    CASE
      WHEN NEW.barcode IS NULL OR NEW.barcode = '' THEN NEW.barcode
      WHEN NEW.barcode REGEXP '^[0-9 ,\.]+$' THEN SUBSTRING_INDEX(REPLACE(REPLACE(TRIM(NEW.barcode), ' ', ''), ',', '.'), '.', 1)
      ELSE REPLACE(TRIM(NEW.barcode), ' ', '')
    END;
END //

DROP TRIGGER IF EXISTS products_barcode_before_update //
CREATE TRIGGER products_barcode_before_update
BEFORE UPDATE ON products
FOR EACH ROW
BEGIN
  SET NEW.barcode =
    CASE
      WHEN NEW.barcode IS NULL OR NEW.barcode = '' THEN NEW.barcode
      WHEN NEW.barcode REGEXP '^[0-9 ,\.]+$' THEN SUBSTRING_INDEX(REPLACE(REPLACE(TRIM(NEW.barcode), ' ', ''), ',', '.'), '.', 1)
      ELSE REPLACE(TRIM(NEW.barcode), ' ', '')
    END;
END //

DELIMITER ;
