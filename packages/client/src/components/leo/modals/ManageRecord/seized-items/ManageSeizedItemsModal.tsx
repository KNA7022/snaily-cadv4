import { Form, Formik, useFormikContext } from "formik";
import { useTranslations } from "use-intl";
import { Button } from "components/Button";
import { FormField } from "components/form/FormField";
import { Modal } from "components/modal/Modal";
import { useModal } from "state/modalState";
import { ModalIds } from "types/ModalIds";
import type { SeizedItem } from "@snailycad/types";
import { Input } from "components/form/inputs/Input";
import { Toggle } from "components/form/Toggle";

interface Props {
  item?: SeizedItem | null;
  onClose?(): void;
}

export function ManageSeizedItemsModal({ item, onClose }: Props) {
  const { isOpen, closeModal } = useModal();
  const common = useTranslations("Common");
  const t = useTranslations("Leo");
  const { values, setFieldValue } = useFormikContext<{ seizedItems: SeizedItem[] }>();

  async function onSubmit(data: typeof INITIAL_VALUES) {
    if (!data.item) {
      return;
    }

    if (item) {
      const seizedItems = values.seizedItems;
      const idxOf = seizedItems.indexOf(item);

      if (idxOf !== -1) {
        seizedItems[idxOf] = { ...item, ...data };
      }

      setFieldValue("seizedItems", seizedItems);
      handleClose();
    } else {
      setFieldValue("seizedItems", [...values.seizedItems, data]);
      handleClose();
    }
  }

  const INITIAL_VALUES = {
    item: item?.item ?? "",
    illegal: item?.illegal ?? false,
    quantity: item?.quantity ?? 1,
  };

  function handleClose() {
    onClose?.();
    closeModal(ModalIds.ManageSeizedItems);
  }

  return (
    <Modal
      title={item ? t("editSeizedItem") : t("addSeizedItem")}
      isOpen={isOpen(ModalIds.ManageSeizedItems)}
      onClose={handleClose}
      className="w-[600px]"
    >
      <Formik onSubmit={onSubmit} initialValues={INITIAL_VALUES}>
        {({ handleChange, values, errors, isValid }) => (
          <Form autoComplete="off">
            <FormField errorMessage={errors.item} label={common("name")}>
              <Input name="item" onChange={handleChange} value={values.item} />
            </FormField>

            <FormField errorMessage={errors.quantity} label={t("quantity")}>
              <Input
                type="number"
                name="quantity"
                onChange={handleChange}
                value={values.quantity}
              />
            </FormField>

            <FormField className="mt-1" checkbox errorMessage={errors.illegal} label={t("illegal")}>
              <Toggle name="illegal" onClick={handleChange} toggled={values.illegal} />
            </FormField>

            <footer className="flex justify-end mt-5">
              <Button type="reset" onClick={handleClose} variant="cancel">
                {common("cancel")}
              </Button>
              <Button className="flex items-center" disabled={!isValid} type="submit">
                {item ? common("save") : t("add")}
              </Button>
            </footer>
          </Form>
        )}
      </Formik>
    </Modal>
  );
}
