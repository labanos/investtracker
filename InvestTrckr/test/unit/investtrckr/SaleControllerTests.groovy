package investtrckr



import org.junit.*
import grails.test.mixin.*

@TestFor(SaleController)
@Mock(Sale)
class SaleControllerTests {

    def populateValidParams(params) {
        assert params != null
        // TODO: Populate valid properties like...
        //params["name"] = 'someValidName'
    }

    void testIndex() {
        controller.index()
        assert "/sale/list" == response.redirectedUrl
    }

    void testList() {

        def model = controller.list()

        assert model.saleInstanceList.size() == 0
        assert model.saleInstanceTotal == 0
    }

    void testCreate() {
        def model = controller.create()

        assert model.saleInstance != null
    }

    void testSave() {
        controller.save()

        assert model.saleInstance != null
        assert view == '/sale/create'

        response.reset()

        populateValidParams(params)
        controller.save()

        assert response.redirectedUrl == '/sale/show/1'
        assert controller.flash.message != null
        assert Sale.count() == 1
    }

    void testShow() {
        controller.show()

        assert flash.message != null
        assert response.redirectedUrl == '/sale/list'

        populateValidParams(params)
        def sale = new Sale(params)

        assert sale.save() != null

        params.id = sale.id

        def model = controller.show()

        assert model.saleInstance == sale
    }

    void testEdit() {
        controller.edit()

        assert flash.message != null
        assert response.redirectedUrl == '/sale/list'

        populateValidParams(params)
        def sale = new Sale(params)

        assert sale.save() != null

        params.id = sale.id

        def model = controller.edit()

        assert model.saleInstance == sale
    }

    void testUpdate() {
        controller.update()

        assert flash.message != null
        assert response.redirectedUrl == '/sale/list'

        response.reset()

        populateValidParams(params)
        def sale = new Sale(params)

        assert sale.save() != null

        // test invalid parameters in update
        params.id = sale.id
        //TODO: add invalid values to params object

        controller.update()

        assert view == "/sale/edit"
        assert model.saleInstance != null

        sale.clearErrors()

        populateValidParams(params)
        controller.update()

        assert response.redirectedUrl == "/sale/show/$sale.id"
        assert flash.message != null

        //test outdated version number
        response.reset()
        sale.clearErrors()

        populateValidParams(params)
        params.id = sale.id
        params.version = -1
        controller.update()

        assert view == "/sale/edit"
        assert model.saleInstance != null
        assert model.saleInstance.errors.getFieldError('version')
        assert flash.message != null
    }

    void testDelete() {
        controller.delete()
        assert flash.message != null
        assert response.redirectedUrl == '/sale/list'

        response.reset()

        populateValidParams(params)
        def sale = new Sale(params)

        assert sale.save() != null
        assert Sale.count() == 1

        params.id = sale.id

        controller.delete()

        assert Sale.count() == 0
        assert Sale.get(sale.id) == null
        assert response.redirectedUrl == '/sale/list'
    }
}
