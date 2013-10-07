package investtrckr



import org.junit.*
import grails.test.mixin.*

@TestFor(PurchaseController)
@Mock(Purchase)
class PurchaseControllerTests {

    def populateValidParams(params) {
        assert params != null
        // TODO: Populate valid properties like...
        //params["name"] = 'someValidName'
    }

    void testIndex() {
        controller.index()
        assert "/purchase/list" == response.redirectedUrl
    }

    void testList() {

        def model = controller.list()

        assert model.purchaseInstanceList.size() == 0
        assert model.purchaseInstanceTotal == 0
    }

    void testCreate() {
        def model = controller.create()

        assert model.purchaseInstance != null
    }

    void testSave() {
        controller.save()

        assert model.purchaseInstance != null
        assert view == '/purchase/create'

        response.reset()

        populateValidParams(params)
        controller.save()

        assert response.redirectedUrl == '/purchase/show/1'
        assert controller.flash.message != null
        assert Purchase.count() == 1
    }

    void testShow() {
        controller.show()

        assert flash.message != null
        assert response.redirectedUrl == '/purchase/list'

        populateValidParams(params)
        def purchase = new Purchase(params)

        assert purchase.save() != null

        params.id = purchase.id

        def model = controller.show()

        assert model.purchaseInstance == purchase
    }

    void testEdit() {
        controller.edit()

        assert flash.message != null
        assert response.redirectedUrl == '/purchase/list'

        populateValidParams(params)
        def purchase = new Purchase(params)

        assert purchase.save() != null

        params.id = purchase.id

        def model = controller.edit()

        assert model.purchaseInstance == purchase
    }

    void testUpdate() {
        controller.update()

        assert flash.message != null
        assert response.redirectedUrl == '/purchase/list'

        response.reset()

        populateValidParams(params)
        def purchase = new Purchase(params)

        assert purchase.save() != null

        // test invalid parameters in update
        params.id = purchase.id
        //TODO: add invalid values to params object

        controller.update()

        assert view == "/purchase/edit"
        assert model.purchaseInstance != null

        purchase.clearErrors()

        populateValidParams(params)
        controller.update()

        assert response.redirectedUrl == "/purchase/show/$purchase.id"
        assert flash.message != null

        //test outdated version number
        response.reset()
        purchase.clearErrors()

        populateValidParams(params)
        params.id = purchase.id
        params.version = -1
        controller.update()

        assert view == "/purchase/edit"
        assert model.purchaseInstance != null
        assert model.purchaseInstance.errors.getFieldError('version')
        assert flash.message != null
    }

    void testDelete() {
        controller.delete()
        assert flash.message != null
        assert response.redirectedUrl == '/purchase/list'

        response.reset()

        populateValidParams(params)
        def purchase = new Purchase(params)

        assert purchase.save() != null
        assert Purchase.count() == 1

        params.id = purchase.id

        controller.delete()

        assert Purchase.count() == 0
        assert Purchase.get(purchase.id) == null
        assert response.redirectedUrl == '/purchase/list'
    }
}
