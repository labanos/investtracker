package investtrckr

import org.springframework.dao.DataIntegrityViolationException

class InvestmentController {

    static allowedMethods = [save: "POST", update: "POST", delete: "POST"]

    def index() {
        redirect(action: "list", params: params)
    }

    def list(Integer max) {
        params.max = Math.min(max ?: 10, 100)
        [investmentInstanceList: Investment.list(params), investmentInstanceTotal: Investment.count()]
    }

    def create() {
        [investmentInstance: new Investment(params)]
    }

    def save() {
        def investmentInstance = new Investment(params)
        if (!investmentInstance.save(flush: true)) {
            render(view: "create", model: [investmentInstance: investmentInstance])
            return
        }

        flash.message = message(code: 'default.created.message', args: [message(code: 'investment.label', default: 'Investment'), investmentInstance.id])
        redirect(action: "show", id: investmentInstance.id)
    }

    def show(Long id) {
        def investmentInstance = Investment.get(id)
        if (!investmentInstance) {
            flash.message = message(code: 'default.not.found.message', args: [message(code: 'investment.label', default: 'Investment'), id])
            redirect(action: "list")
            return
        }

        [investmentInstance: investmentInstance]
    }

    def edit(Long id) {
        def investmentInstance = Investment.get(id)
        if (!investmentInstance) {
            flash.message = message(code: 'default.not.found.message', args: [message(code: 'investment.label', default: 'Investment'), id])
            redirect(action: "list")
            return
        }

        [investmentInstance: investmentInstance]
    }

    def update(Long id, Long version) {
        def investmentInstance = Investment.get(id)
        if (!investmentInstance) {
            flash.message = message(code: 'default.not.found.message', args: [message(code: 'investment.label', default: 'Investment'), id])
            redirect(action: "list")
            return
        }

        if (version != null) {
            if (investmentInstance.version > version) {
                investmentInstance.errors.rejectValue("version", "default.optimistic.locking.failure",
                          [message(code: 'investment.label', default: 'Investment')] as Object[],
                          "Another user has updated this Investment while you were editing")
                render(view: "edit", model: [investmentInstance: investmentInstance])
                return
            }
        }

        investmentInstance.properties = params

        if (!investmentInstance.save(flush: true)) {
            render(view: "edit", model: [investmentInstance: investmentInstance])
            return
        }

        flash.message = message(code: 'default.updated.message', args: [message(code: 'investment.label', default: 'Investment'), investmentInstance.id])
        redirect(action: "show", id: investmentInstance.id)
    }

    def delete(Long id) {
        def investmentInstance = Investment.get(id)
        if (!investmentInstance) {
            flash.message = message(code: 'default.not.found.message', args: [message(code: 'investment.label', default: 'Investment'), id])
            redirect(action: "list")
            return
        }

        try {
            investmentInstance.delete(flush: true)
            flash.message = message(code: 'default.deleted.message', args: [message(code: 'investment.label', default: 'Investment'), id])
            redirect(action: "list")
        }
        catch (DataIntegrityViolationException e) {
            flash.message = message(code: 'default.not.deleted.message', args: [message(code: 'investment.label', default: 'Investment'), id])
            redirect(action: "show", id: id)
        }
    }
}
