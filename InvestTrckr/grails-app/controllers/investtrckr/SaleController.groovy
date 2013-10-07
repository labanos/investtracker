package investtrckr

import org.springframework.dao.DataIntegrityViolationException

class SaleController {

    static allowedMethods = [save: "POST", update: "POST", delete: "POST"]

    def index() {
        redirect(action: "list", params: params)
    }

    def list(Integer max) {
        params.max = Math.min(max ?: 10, 100)
        [saleInstanceList: Sale.list(params), saleInstanceTotal: Sale.count()]
    }

    def create() {
        [saleInstance: new Sale(params)]
    }

    def save() {
        def saleInstance = new Sale(params)
        if (!saleInstance.save(flush: true)) {
            render(view: "create", model: [saleInstance: saleInstance])
            return
        }

        flash.message = message(code: 'default.created.message', args: [message(code: 'sale.label', default: 'Sale'), saleInstance.id])
        redirect(action: "show", id: saleInstance.id)
    }

    def show(Long id) {
        def saleInstance = Sale.get(id)
        if (!saleInstance) {
            flash.message = message(code: 'default.not.found.message', args: [message(code: 'sale.label', default: 'Sale'), id])
            redirect(action: "list")
            return
        }

        [saleInstance: saleInstance]
    }

    def edit(Long id) {
        def saleInstance = Sale.get(id)
        if (!saleInstance) {
            flash.message = message(code: 'default.not.found.message', args: [message(code: 'sale.label', default: 'Sale'), id])
            redirect(action: "list")
            return
        }

        [saleInstance: saleInstance]
    }

    def update(Long id, Long version) {
        def saleInstance = Sale.get(id)
        if (!saleInstance) {
            flash.message = message(code: 'default.not.found.message', args: [message(code: 'sale.label', default: 'Sale'), id])
            redirect(action: "list")
            return
        }

        if (version != null) {
            if (saleInstance.version > version) {
                saleInstance.errors.rejectValue("version", "default.optimistic.locking.failure",
                          [message(code: 'sale.label', default: 'Sale')] as Object[],
                          "Another user has updated this Sale while you were editing")
                render(view: "edit", model: [saleInstance: saleInstance])
                return
            }
        }

        saleInstance.properties = params

        if (!saleInstance.save(flush: true)) {
            render(view: "edit", model: [saleInstance: saleInstance])
            return
        }

        flash.message = message(code: 'default.updated.message', args: [message(code: 'sale.label', default: 'Sale'), saleInstance.id])
        redirect(action: "show", id: saleInstance.id)
    }

    def delete(Long id) {
        def saleInstance = Sale.get(id)
        if (!saleInstance) {
            flash.message = message(code: 'default.not.found.message', args: [message(code: 'sale.label', default: 'Sale'), id])
            redirect(action: "list")
            return
        }

        try {
            saleInstance.delete(flush: true)
            flash.message = message(code: 'default.deleted.message', args: [message(code: 'sale.label', default: 'Sale'), id])
            redirect(action: "list")
        }
        catch (DataIntegrityViolationException e) {
            flash.message = message(code: 'default.not.deleted.message', args: [message(code: 'sale.label', default: 'Sale'), id])
            redirect(action: "show", id: id)
        }
    }
}
